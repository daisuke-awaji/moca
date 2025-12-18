/**
 * AgentCore Runtime HTTP Server
 * AgentCore Runtime で動作する HTTP サーバー
 */

import express, { Request, Response, NextFunction } from "express";
import { Agent } from "@strands-agents/sdk";
import { createAgent } from "./agent.js";

const PORT = process.env.PORT || 8080;
const app = express();

// Agent インスタンス（非同期で初期化）
let agent: Agent | null = null;

// Agent の初期化
async function initializeAgent(): Promise<void> {
  try {
    console.log("🤖 AgentCore AI Agent を初期化中...");
    agent = await createAgent();
    console.log("✅ AI Agent の準備が完了しました！");
  } catch (error) {
    console.error("💥 AI Agent の初期化に失敗しました:", error);
    throw error;
  }
}

// リクエストボディを raw データとして受け取る設定
app.use("/invocations", express.raw({ type: "application/octet-stream" }));
app.use(express.json());

/**
 * ヘルスチェックエンドポイント
 * AgentCore Runtime が正常に動作していることを確認するためのエンドポイント
 */
app.get("/ping", (req: Request, res: Response) => {
  res.json({
    status: "Healthy",
    time_of_last_update: Math.floor(Date.now() / 1000),
  });
});

/**
 * Agent 呼び出しエンドポイント
 * ユーザーからのクエリを受け取り、Agent に処理させて結果を返す
 */
app.post("/invocations", async (req: Request, res: Response) => {
  try {
    // Agent が初期化されているかチェック
    if (!agent) {
      return res.status(503).json({
        error: "Service Unavailable",
        message: "Agent is not initialized yet",
      });
    }

    // リクエストボディからプロンプトを取得
    const prompt = req.body?.toString("utf-8") || "";

    if (!prompt.trim()) {
      return res.status(400).json({
        error: "Empty prompt provided",
      });
    }

    console.log(`📝 Received prompt: ${prompt}`);

    // Agent でプロンプトを処理
    const result = await agent.invoke(prompt);

    console.log(
      `✅ Agent response completed. Stop reason: ${result.stopReason}`
    );

    // 結果を JSON で返す
    return res.json({
      response: result,
    });
  } catch (error) {
    console.error("❌ Error processing request:", error);

    // エラーレスポンスを返す
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * ルートエンドポイント（情報表示用）
 */
app.get("/", (req: Request, res: Response) => {
  res.json({
    service: "AgentCore Runtime Agent",
    version: "0.1.0",
    endpoints: {
      health: "GET /ping",
      invoke: "POST /invocations",
    },
    status: "running",
  });
});

/**
 * 404 ハンドラー
 */
app.use("*", (req: Request, res: Response) => {
  res.status(404).json({
    error: "Not Found",
    message: `Endpoint ${req.method} ${req.path} not found`,
    availableEndpoints: ["GET /", "GET /ping", "POST /invocations"],
  });
});

/**
 * エラーハンドラー
 */
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("💥 Unhandled error:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: err.message,
  });
});

/**
 * アプリケーション開始
 */
async function startServer(): Promise<void> {
  try {
    // Agent初期化
    await initializeAgent();

    // HTTPサーバー開始
    app.listen(PORT, () => {
      console.log(`🚀 AgentCore Runtime server listening on port ${PORT}`);
      console.log(`📋 Health check: http://localhost:${PORT}/ping`);
      console.log(
        `🤖 Agent endpoint: POST http://localhost:${PORT}/invocations`
      );
    });
  } catch (error) {
    console.error("💥 サーバー開始に失敗しました:", error);
    process.exit(1);
  }
}

// サーバー開始
startServer();

// Graceful shutdown の処理
process.on("SIGTERM", () => {
  console.log("🛑 Received SIGTERM, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("🛑 Received SIGINT, shutting down gracefully");
  process.exit(0);
});
