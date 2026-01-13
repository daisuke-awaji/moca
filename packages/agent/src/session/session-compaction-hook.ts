/**
 * Session compaction hook
 * HookProvider that compacts conversation history when it exceeds a threshold
 * by summarizing old messages and keeping only recent ones
 */

import {
  HookProvider,
  HookRegistry,
  BeforeInvocationEvent,
  Message,
  TextBlock,
} from '@strands-agents/sdk';
import type { SessionConfig, SessionStorage } from './types.js';
import type { CompactionConfig } from './compaction/types.js';
import { generateSummary } from './compaction/summarizer.js';
import { logger } from '../config/index.js';

/** Prefix for summary messages to identify them */
const SUMMARY_PREFIX = '[Previous conversation summary]\n';

/**
 * Hook that compacts session history when message count exceeds threshold
 *
 * Usage:
 * const hook = new SessionCompactionHook(storage, sessionConfig, compactionConfig, region);
 * const agent = new Agent({ hooks: [hook] });
 */
export class SessionCompactionHook implements HookProvider {
  constructor(
    private readonly storage: SessionStorage,
    private readonly sessionConfig: SessionConfig,
    private readonly compactionConfig: CompactionConfig,
    private readonly region: string
  ) {}

  /**
   * Register hook callbacks to registry
   */
  registerCallbacks(registry: HookRegistry): void {
    registry.addCallback(BeforeInvocationEvent, (event) => this.onBeforeInvocation(event));
  }

  /**
   * Event handler before Agent invocation
   * Checks message count and triggers compaction if threshold exceeded
   */
  private async onBeforeInvocation(_event: BeforeInvocationEvent): Promise<void> {
    if (!this.compactionConfig.enabled) {
      logger.debug('[SessionCompactionHook] Compaction is disabled');
      return;
    }

    const { actorId, sessionId } = this.sessionConfig;

    try {
      // Load current messages
      const messages = await this.storage.loadMessages(this.sessionConfig);

      logger.info('[SessionCompactionHook] Checking compaction threshold', {
        actorId,
        sessionId,
        currentMessageCount: messages.length,
        threshold: this.compactionConfig.messageThreshold,
      });

      // Check if compaction is needed
      if (messages.length <= this.compactionConfig.messageThreshold) {
        logger.debug('[SessionCompactionHook] Threshold not exceeded, skipping compaction');
        return;
      }

      // Execute compaction
      logger.info('[SessionCompactionHook] Starting compaction', {
        actorId,
        sessionId,
        messageCount: messages.length,
      });

      await this.compactSession(messages);

      logger.info('[SessionCompactionHook] Compaction completed', {
        actorId,
        sessionId,
      });
    } catch (error) {
      // Log error but don't throw - allow agent to continue with existing history
      logger.error('[SessionCompactionHook] Compaction failed, continuing with existing history', {
        actorId,
        sessionId,
        error,
      });
    }
  }

  /**
   * Compact session by summarizing old messages and keeping recent ones
   */
  private async compactSession(messages: Message[]): Promise<void> {
    const { keepRecentMessages } = this.compactionConfig;

    // Split messages into old (to summarize) and recent (to keep)
    const messagesToSummarize = messages.slice(0, -keepRecentMessages);
    const recentMessages = messages.slice(-keepRecentMessages);

    logger.info('[SessionCompactionHook] Splitting messages', {
      totalMessages: messages.length,
      messagesToSummarize: messagesToSummarize.length,
      recentMessagesToKeep: recentMessages.length,
    });

    // Generate summary of old messages
    const summary = await generateSummary(messagesToSummarize, this.region);

    // Create summary message using TextBlock
    const summaryTextBlock = new TextBlock(`${SUMMARY_PREFIX}${summary}`);
    const summaryMessage = new Message({
      role: 'user',
      content: [summaryTextBlock],
    });

    // Create a placeholder assistant response for the summary
    // This maintains the user-assistant alternation pattern
    const summaryAckTextBlock = new TextBlock(
      'I understand the context from our previous conversation. I will continue from where we left off.'
    );
    const summaryAck = new Message({
      role: 'assistant',
      content: [summaryAckTextBlock],
    });

    // Compose new message history
    const compactedMessages = [summaryMessage, summaryAck, ...recentMessages];

    logger.info('[SessionCompactionHook] Replacing session history', {
      originalCount: messages.length,
      compactedCount: compactedMessages.length,
    });

    // Clear existing session and save compacted messages
    await this.storage.clearSession(this.sessionConfig);
    await this.storage.saveMessages(this.sessionConfig, compactedMessages);
  }
}
