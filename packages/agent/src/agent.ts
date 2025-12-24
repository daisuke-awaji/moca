/**
 * Strands AI Agent for AgentCore Runtime
 * AgentCore Runtime で動作し、AgentCore Gateway のツールを使用する AI Agent
 */

import { Agent, HookProvider } from '@strands-agents/sdk';
import { logger } from './config/index.js';
import { localTools, convertMCPToolsToStrands } from './tools/index.js';
import { buildSystemPrompt } from './prompts/index.js';
import { createBedrockModel } from './models/index.js';
import { MCPToolDefinition } from './schemas/types.js';
import { mcpClient } from './mcp/client.js';
import { getCurrentStoragePath } from './context/request-context.js';
import type { SessionStorage, SessionConfig } from './session/types.js';

/**
 * AgentCore Runtime 用の Strands Agent 作成オプション
 */
export interface CreateAgentOptions {
  modelId?: string; // 使用するモデルID（未指定時は環境変数）
  enabledTools?: string[]; // 有効化するツール名配列（undefined=全て、[]=なし）
  systemPrompt?: string; // カスタムシステムプロンプト（未指定時は自動生成）
  // セッション復元用（並列処理のため）
  sessionStorage?: SessionStorage;
  sessionConfig?: SessionConfig;
}

/**
 * ツールをフィルタリング
 */
function filterTools<T extends { name: string }>(tools: T[], enabledTools?: string[]): T[] {
  if (enabledTools === undefined) return tools;
  if (enabledTools.length === 0) {
    logger.info('🔧 ツールを無効化: 空配列が指定されました');
    return [];
  }

  const filtered = tools.filter((tool) => enabledTools.includes(tool.name));
  logger.info(`🔧 ツールをフィルタリング: ${enabledTools.join(', ')}`);
  return filtered;
}

/**
 * AgentCore Runtime 用の Strands Agent を作成
 * @param hooks HookProvider の配列（セッション永続化など）
 * @param options Agent作成オプション（モデルID、ツール、システムプロンプト、セッション設定）
 */
export async function createAgent(
  hooks?: HookProvider[],
  options?: CreateAgentOptions
): Promise<Agent> {
  logger.info('Strands Agent を初期化中...');

  try {
    // 1. セッション履歴復元とMCPツール取得を並列実行
    const [savedMessages, mcpTools] = await Promise.all([
      options?.sessionStorage && options?.sessionConfig
        ? options.sessionStorage.loadMessages(options.sessionConfig)
        : Promise.resolve([]),
      mcpClient.listTools(),
    ]);

    logger.info(`📖 セッション履歴を復元: ${savedMessages.length}件のメッセージ`);

    // 2. MCP ツールを変換
    const mcpStrandsTools = convertMCPToolsToStrands(mcpTools as MCPToolDefinition[]);

    // 2. ローカルツールとMCPツールを結合
    let allTools = [...localTools, ...mcpStrandsTools];
    allTools = filterTools(allTools, options?.enabledTools);
    logger.info(`✅ 合計${allTools.length}個のツールを準備しました`);

    // 3. Bedrock モデルを作成
    const model = createBedrockModel({ modelId: options?.modelId });
    logger.info(`🤖 使用モデル: ${options?.modelId || 'デフォルト'}`);

    // 4. システムプロンプトを生成（ストレージパス情報を含む）
    const storagePath = getCurrentStoragePath();
    const systemPrompt = buildSystemPrompt({
      customPrompt: options?.systemPrompt,
      tools: allTools,
      mcpTools: mcpTools as MCPToolDefinition[],
      storagePath,
    });

    if (options?.systemPrompt) {
      logger.info('📝 カスタムシステムプロンプトを使用');
    } else {
      logger.info('📝 デフォルトシステムプロンプトを生成');
    }
    logger.info('📝 デフォルトコンテキストを付与したシステムプロンプトを生成');

    // 5. Agent を作成
    const agent = new Agent({
      model,
      systemPrompt,
      tools: allTools,
      messages: savedMessages,
      hooks,
    });

    // 6. ログ出力
    if (hooks && hooks.length > 0) {
      logger.info(`✅ ${hooks.length}個のフックを登録`);
    }

    logger.info('✅ Strands Agent の初期化が完了しました');
    return agent;
  } catch (error) {
    logger.error('❌ Strands Agent の初期化に失敗:', error);
    throw error;
  }
}
