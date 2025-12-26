/**
 * Workspace Sync Hook
 * ツール実行後に自動的にローカルワークスペースをS3と同期
 */

import { HookProvider, HookRegistry, AfterToolsEvent } from '@strands-agents/sdk';
import { WorkspaceSync } from '../services/workspace-sync.js';
import { logger } from '../config/index.js';

/**
 * ツール実行後にワークスペースをS3と同期するフック
 */
export class WorkspaceSyncHook implements HookProvider {
  constructor(private readonly workspaceSync: WorkspaceSync) {}

  /**
   * フックコールバックをレジストリに登録
   */
  registerCallbacks(registry: HookRegistry): void {
    // ツール実行後に S3 へ同期
    registry.addCallback(AfterToolsEvent, (event) => this.onAfterTools(event));
  }

  /**
   * ツール実行後のイベントハンドラ
   * ファイル操作の可能性があるため、すべてのツール実行後に同期
   */
  private async onAfterTools(_event: AfterToolsEvent): Promise<void> {
    try {
      logger.info('[WORKSPACE_SYNC_HOOK] Triggering sync to S3 after tool execution...');

      // 非同期で同期を実行（レスポンスをブロックしない）
      // エラーが発生しても Agent の実行は継続
      this.workspaceSync.syncToS3().catch((error) => {
        logger.error('[WORKSPACE_SYNC_HOOK] Sync to S3 failed:', error);
      });
    } catch (error) {
      // フック内でエラーが発生しても Agent の実行を止めない
      logger.warn('[WORKSPACE_SYNC_HOOK] Error in hook:', error);
    }
  }
}
