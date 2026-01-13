/**
 * セッション管理機能のエクスポート
 */

import type { SessionStorage } from './types.js';
import { FileSessionStorage } from './file-session-storage.js';
import { AgentCoreMemoryStorage } from './agentcore-memory-storage.js';

export type { SessionConfig, SessionStorage } from './types.js';
export { FileSessionStorage } from './file-session-storage.js';
export { AgentCoreMemoryStorage } from './agentcore-memory-storage.js';
export { SessionPersistenceHook } from './session-persistence-hook.js';
export { SessionCompactionHook } from './session-compaction-hook.js';
export { retrieveLongTermMemory } from './memory-retriever.js';
export { CompactionConfig, DEFAULT_COMPACTION_CONFIG } from './compaction/index.js';

/**
 * 環境変数に基づいてSessionStorageを作成する
 * AGENTCORE_MEMORY_IDが設定されていれば常にAgentCore Memoryを使用
 * @returns 適切なSessionStorageインスタンス
 */
export function createSessionStorage(): SessionStorage {
  const memoryId = process.env.AGENTCORE_MEMORY_ID;
  const region = process.env.AWS_REGION || 'us-east-1';

  if (!memoryId) {
    console.warn(
      '[SessionStorage] AGENTCORE_MEMORY_ID is not set, falling back to FileSessionStorage'
    );
    return new FileSessionStorage();
  }

  console.log(`[SessionStorage] Using AgentCore Memory: ${memoryId} (${region})`);
  return new AgentCoreMemoryStorage(memoryId, region);
}
