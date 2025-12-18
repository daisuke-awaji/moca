/**
 * Strands AI Agent - Default Implementation
 * AgentCore Gateway のツールを使用する最もシンプルな AI Agent
 */

import { Agent, tool } from "@strands-agents/sdk";
import { z } from "zod";
import { config, logger } from "../config/index.js";
import { mcpClient, MCPToolResult } from "../mcp/client.js";

/**
 * MCP ツール定義の型
 */
interface MCPToolDefinition {
  name: string;
  description?: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * Strands AI Agent for AgentCore Gateway
 */
export class StrandsAgent {
  private agent: Agent | null = null;
  private isInitialized = false;

  constructor() {
    // Agent は initialize() で作成（ツールが必要なため）
    logger.debug(
      "StrandsAgent を初期化しました（Agent作成は initialize() で実行）"
    );
  }

  /**
   * JSON Schema を Zod Schema に変換
   */
  private convertToZodSchema(jsonSchema: any): z.ZodObject<any> {
    if (!jsonSchema || jsonSchema.type !== "object") {
      return z.object({});
    }

    const properties = jsonSchema.properties || {};
    const required = jsonSchema.required || [];
    const zodFields: Record<string, any> = {};

    for (const [key, prop] of Object.entries(properties)) {
      const propSchema = prop as any;
      let zodType: any;

      switch (propSchema.type) {
        case "string":
          zodType = z.string();
          break;
        case "number":
        case "integer":
          zodType = z.number();
          break;
        case "boolean":
          zodType = z.boolean();
          break;
        case "array":
          zodType = z.array(z.any());
          break;
        case "object":
          zodType = z.record(z.any());
          break;
        default:
          zodType = z.any();
      }

      if (propSchema.description) {
        zodType = zodType.describe(propSchema.description);
      }

      if (!required.includes(key)) {
        zodType = zodType.optional();
      }

      zodFields[key] = zodType;
    }

    return z.object(zodFields);
  }

  /**
   * MCP ツールを Strands ツールに変換
   */
  private createStrandsToolFromMCP(mcpTool: MCPToolDefinition) {
    return tool({
      name: mcpTool.name,
      description:
        mcpTool.description || `AgentCore Gateway ツール: ${mcpTool.name}`,
      inputSchema: this.convertToZodSchema(mcpTool.inputSchema) as any,
      callback: async (input: any): Promise<string> => {
        try {
          logger.debug(`ツール呼び出し: ${mcpTool.name}`, input);
          const result: MCPToolResult = await mcpClient.callTool(
            mcpTool.name,
            input
          );

          if (result.isError) {
            logger.error(`ツール実行エラー: ${mcpTool.name}`, result);
            return `ツール実行エラー: ${
              result.content[0]?.text || "不明なエラー"
            }`;
          }

          // 結果を文字列として返す
          const contentText = result.content
            .map((item) => {
              if (item.text) return item.text;
              if (item.json) return JSON.stringify(item.json, null, 2);
              return "";
            })
            .filter(Boolean)
            .join("\n");

          return contentText || "ツールの実行が完了しました。";
        } catch (error) {
          logger.error(`ツール呼び出し中にエラー: ${mcpTool.name}`, error);
          return `ツール呼び出し中にエラーが発生しました: ${error}`;
        }
      },
    });
  }

  /**
   * Agent を初期化
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info("Strands Agent を初期化中...");

      // 1. MCP クライアントからツール一覧を取得
      logger.debug("AgentCore Gateway からツール一覧を取得中...");
      const mcpTools = await mcpClient.listTools();
      logger.info(`✅ ${mcpTools.length}個のツールを取得しました`);

      // 2. 各ツールを Strands の tool() 形式に変換
      const strandsTools = mcpTools.map((mcpTool) => {
        logger.debug(`ツール変換中: ${mcpTool.name}`);
        return this.createStrandsToolFromMCP(mcpTool as MCPToolDefinition);
      });

      const systemPrompt = `あなたはAgentCore Gatewayのデモ用AI Agentです。

以下のツールを使用できます：
${mcpTools
  .map((tool) => `- ${tool.name}: ${tool.description || "説明なし"}`)
  .join("\n")}

ユーザーからの質問に日本語で丁寧に応答し、必要に応じて適切なツールを呼び出してください。
技術的な内容についても分かりやすく説明してください。`;

      // 3. Agent を作成
      this.agent = new Agent({
        systemPrompt,
        tools: strandsTools,
      });

      this.isInitialized = true;
      logger.info("✅ Strands Agent の初期化が完了しました");
    } catch (error) {
      logger.error("❌ Strands Agent の初期化に失敗:", error);
      throw error;
    }
  }

  /**
   * ユーザークエリを処理
   */
  async invoke(query: string): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.agent) {
      throw new Error("Agent が初期化されていません");
    }

    try {
      logger.info("Agent にクエリを送信:", query);
      const response = await this.agent.invoke(query);
      return typeof response === "string" ? response : JSON.stringify(response);
    } catch (error) {
      logger.error("❌ Agent invoke エラー:", error);
      return `エラーが発生しました: ${error}`;
    }
  }

  /**
   * 初期化状態を取得
   */
  get initialized(): boolean {
    return this.isInitialized;
  }
}
