/**
 * MCP 設定処理ユーティリティ
 */

import { logger } from '../config/index.js';
import type { MCPConfig, MCPServerConfig } from './types.js';

/**
 * MCPサーバー設定にtransportフィールドを自動推測して追加
 * - commandがあれば stdio
 * - urlがあれば http (デフォルト)
 */
function inferTransport(serverConfig: Record<string, unknown>): Record<string, unknown> {
  // 既にtransportが指定されている場合はそのまま
  if (serverConfig.transport) {
    return serverConfig;
  }

  // commandがあればstdio
  if (serverConfig.command) {
    logger.debug('transport を自動推測: stdio (command フィールドが存在)');
    return { ...serverConfig, transport: 'stdio' };
  }

  // urlがあればhttp (デフォルト、将来的にSSE判定を追加可能)
  if (serverConfig.url) {
    logger.debug('transport を自動推測: http (url フィールドが存在)');
    return { ...serverConfig, transport: 'http' };
  }

  // どちらもない場合はそのまま（Zodバリデーションでエラーになる）
  return serverConfig;
}

/**
 * 有効なMCPサーバー設定のみを抽出
 * transport が未指定の場合は自動推測を適用
 */
export function getEnabledMCPServers(config: MCPConfig): Array<{
  name: string;
  config: MCPServerConfig;
}> {
  return Object.entries(config.mcpServers)
    .filter(([, serverConfig]) => serverConfig.enabled !== false)
    .map(([name, serverConfig]) => ({
      name,
      config: inferTransport(
        serverConfig as unknown as Record<string, unknown>
      ) as unknown as MCPServerConfig,
    }));
}
