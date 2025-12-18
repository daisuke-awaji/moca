/**
 * Ping ツール実装
 *
 * 接続確認とシステム情報を返すツール
 */

import { ToolInput, ToolResult } from "../types.js";
import { Tool } from "./types.js";
import { logger } from "../logger.js";

/**
 * Pingツールの出力型
 */
interface PingResult extends ToolResult {
  status: "pong";
  timestamp: string;
  uptime: number;
  version: string;
  platform: string;
  arch: string;
  memory: NodeJS.MemoryUsage;
}

/**
 * Pingツールのメイン処理
 *
 * @param input 入力データ（Pingでは使用しない）
 * @returns Pingの実行結果
 */
async function handlePing(input: ToolInput): Promise<PingResult> {
  const memory = process.memoryUsage();
  const timestamp = new Date().toISOString();

  // システム情報を収集
  const systemInfo = getSystemInfo(memory, input);

  // ログ出力
  logger.debug("PING_RESULT", {
    uptime: Math.round(process.uptime()),
    nodeVersion: process.version,
    platform: process.platform,
    memoryMB: Math.round(memory.heapUsed / 1024 / 1024),
    memoryTotalMB: Math.round(memory.heapTotal / 1024 / 1024),
    inputSize: input ? JSON.stringify(input).length : 0,
  });

  // 結果を生成
  const result: PingResult = {
    status: "pong",
    timestamp,
    uptime: process.uptime(),
    version: process.version,
    platform: process.platform,
    arch: process.arch,
    memory,
  };

  return result;
}

/**
 * システム情報を収集・整理する
 *
 * @param memory メモリ使用量情報
 * @param input 入力データ
 * @returns ログ出力用のシステム情報
 */
function getSystemInfo(memory: NodeJS.MemoryUsage, input?: ToolInput) {
  return {
    runtime: {
      version: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: process.uptime(),
    },
    memory: {
      heapUsed: memory.heapUsed,
      heapTotal: memory.heapTotal,
      external: memory.external,
      rss: memory.rss,
      heapUsedMB: Math.round(memory.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(memory.heapTotal / 1024 / 1024),
    },
    input: {
      provided: !!input,
      size: input ? JSON.stringify(input).length : 0,
      keys: input ? Object.keys(input) : [],
    },
  };
}

/**
 * メモリ使用量の分析
 *
 * @param memory メモリ使用量情報
 * @returns メモリ分析結果
 */
function analyzeMemoryUsage(memory: NodeJS.MemoryUsage) {
  const heapUsedMB = memory.heapUsed / 1024 / 1024;
  const heapTotalMB = memory.heapTotal / 1024 / 1024;
  const heapUsagePercent = (memory.heapUsed / memory.heapTotal) * 100;

  return {
    heapUsedMB: Math.round(heapUsedMB),
    heapTotalMB: Math.round(heapTotalMB),
    heapUsagePercent: Math.round(heapUsagePercent),
    isHighUsage: heapUsagePercent > 80,
    isLowUsage: heapUsagePercent < 20,
    externalMB: Math.round(memory.external / 1024 / 1024),
    rssMB: Math.round(memory.rss / 1024 / 1024),
  };
}

/**
 * システム稼働時間の分析
 *
 * @param uptime 稼働時間（秒）
 * @returns 稼働時間分析結果
 */
function analyzeUptime(uptime: number) {
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);

  return {
    totalSeconds: Math.round(uptime),
    formatted: `${hours}h ${minutes}m ${seconds}s`,
    isLongRunning: uptime > 3600, // 1時間以上
    isNewStart: uptime < 300, // 5分未満
  };
}

/**
 * ヘルスチェック情報を生成
 *
 * @returns システムヘルス情報
 */
function generateHealthCheck() {
  const memory = process.memoryUsage();
  const memoryAnalysis = analyzeMemoryUsage(memory);
  const uptimeAnalysis = analyzeUptime(process.uptime());

  return {
    status: "healthy",
    checks: {
      memory: {
        status: memoryAnalysis.isHighUsage ? "warning" : "ok",
        usage: memoryAnalysis.heapUsagePercent,
      },
      uptime: {
        status: uptimeAnalysis.isNewStart ? "starting" : "stable",
        duration: uptimeAnalysis.formatted,
      },
      version: {
        status: "ok",
        node: process.version,
      },
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Pingツールの定義
 */
export const pingTool: Tool = {
  name: "ping",
  handler: handlePing,
  description: "Health check and system information tool",
  version: "1.0.0",
  tags: ["health-check", "system-info", "monitoring"],
};

export default pingTool;
