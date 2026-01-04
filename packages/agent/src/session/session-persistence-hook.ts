/**
 * Session persistence hook
 * HookProvider that automatically saves conversation history before and after Agent execution
 */

import { HookProvider, HookRegistry, AfterInvocationEvent } from '@strands-agents/sdk';
import { SessionConfig, SessionStorage } from './types.js';
import { logger } from '../config/index.js';

/**
 * Hook that persists session history in response to Agent lifecycle events
 *
 * Usage:
 * const hook = new SessionPersistenceHook(storage, { actorId: "user123", sessionId: "session456" });
 * const agent = new Agent({ hooks: [hook] });
 */
export class SessionPersistenceHook implements HookProvider {
  constructor(
    private readonly storage: SessionStorage,
    private readonly sessionConfig: SessionConfig
  ) {}

  /**
   * Register hook callbacks to registry
   */
  registerCallbacks(registry: HookRegistry): void {
    // Save history after Agent execution completes
    registry.addCallback(AfterInvocationEvent, (event) => this.onAfterInvocation(event));
  }

  /**
   * Event handler after Agent execution completes
   * Save conversation history to storage
   * Fallback for when real-time saving is not performed
   */
  private async onAfterInvocation(event: AfterInvocationEvent): Promise<void> {
    try {
      const { actorId, sessionId } = this.sessionConfig;
      const messages = event.agent.messages;

      logger.debug(
        `🔍 AfterInvocation: Agent messages=${messages.length}, checking for unsaved messages`
      );

      // Save conversation history to storage (avoid duplicates if already saved)
      await this.storage.saveMessages(this.sessionConfig, messages);

      logger.debug(
        `💾 Session history auto-save completed (fallback): ${actorId}/${sessionId} (${messages.length} items)`
      );
    } catch (error) {
      // Log at warning level to not stop Agent execution even if error occurs
      logger.warn(
        `⚠️  Session history auto-save failed: ${this.sessionConfig.actorId}/${this.sessionConfig.sessionId}`,
        error
      );
    }
  }
}
