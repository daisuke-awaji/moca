import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";

/**
 * AgentCore Gateway Echo/Ping Tool Lambda Handler
 *
 * このLambda関数はAgentCore Gatewayから呼び出され、
 * Echo（メッセージをそのまま返す）とPing（接続確認）ツールを提供します。
 */

interface ToolRequest {
  tool: string;
  input?: {
    message?: string;
    [key: string]: any;
  };
  sessionId?: string;
  userId?: string;
}

interface ToolResponse {
  result: any;
  error?: string;
  metadata?: {
    timestamp: string;
    tool: string;
    sessionId?: string;
  };
}

export async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  console.log("Received event:", JSON.stringify(event, null, 2));

  try {
    // リクエストボディをパース
    const requestBody: ToolRequest = event.body
      ? JSON.parse(event.body)
      : (event as any);

    const { tool, input, sessionId, userId } = requestBody;

    if (!tool) {
      throw new Error("Tool name is required");
    }

    let result: any;

    // ツール実行
    switch (tool) {
      case "echo":
        result = await handleEcho(input);
        break;

      case "ping":
        result = await handlePing(input);
        break;

      default:
        throw new Error(`Unknown tool: ${tool}`);
    }

    // レスポンス作成
    const response: ToolResponse = {
      result,
      metadata: {
        timestamp: new Date().toISOString(),
        tool,
        sessionId,
      },
    };

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error("Lambda execution error:", error);

    const errorResponse: ToolResponse = {
      result: null,
      error: error instanceof Error ? error.message : "Unknown error",
      metadata: {
        timestamp: new Date().toISOString(),
        tool: "unknown",
      },
    };

    return {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(errorResponse),
    };
  }
}

/**
 * Echo ツール: 入力されたメッセージをそのまま返す
 */
async function handleEcho(input?: { message?: string }): Promise<any> {
  if (!input?.message) {
    throw new Error("Echo tool requires a 'message' parameter");
  }

  console.log(`Echo tool called with message: ${input.message}`);

  return {
    echo: input.message,
    length: input.message.length,
    uppercase: input.message.toUpperCase(),
    lowercase: input.message.toLowerCase(),
  };
}

/**
 * Ping ツール: 接続確認とシステム情報を返す
 */
async function handlePing(input?: any): Promise<any> {
  console.log("Ping tool called");

  return {
    status: "pong",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.version,
    platform: process.platform,
    arch: process.arch,
    memory: process.memoryUsage(),
  };
}

/**
 * OPTIONS リクエスト用のハンドラー（CORS対応）
 */
export async function optionsHandler(): Promise<APIGatewayProxyResult> {
  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
    body: "",
  };
}
