/**
 * AgentCore Memory を使用したセッションストレージの実装
 */
import {
  BedrockAgentCoreClient,
  CreateEventCommand,
  DeleteEventCommand,
  paginateListEvents,
  type PayloadType,
} from '@aws-sdk/client-bedrock-agentcore';
import { Message } from '@strands-agents/sdk';
import type { SessionConfig, SessionStorage } from './types.js';
import {
  messageToAgentCorePayload,
  agentCorePayloadToMessage,
  extractEventId,
  getCurrentTimestamp,
  type AgentCorePayload,
} from './converters.js';
import { logger } from '../config/index.js';

/**
 * AgentCore Memory を使用したセッションストレージ
 */
export class AgentCoreMemoryStorage implements SessionStorage {
  private client: BedrockAgentCoreClient;
  private memoryId: string;

  constructor(memoryId: string, region: string = 'us-east-1') {
    this.client = new BedrockAgentCoreClient({ region });
    this.memoryId = memoryId;
  }

  /**
   * 指定されたセッションの会話履歴を読み込む
   * @param config セッション設定
   * @returns 会話履歴の Message 配列
   */
  async loadMessages(config: SessionConfig): Promise<Message[]> {
    try {
      logger.info('[AgentCoreMemoryStorage] Loading messages:', {
        sessionId: config.sessionId,
        actorId: config.actorId,
      });

      // ページネーション対応：すべてのイベントを取得
      const allEvents = [];
      const paginator = paginateListEvents(
        { client: this.client },
        {
          memoryId: this.memoryId,
          actorId: config.actorId,
          sessionId: config.sessionId,
          includePayloads: true,
          maxResults: 100,
        }
      );

      for await (const page of paginator) {
        if (page.events) {
          allEvents.push(...page.events);
        }
      }

      if (allEvents.length === 0) {
        logger.info('[AgentCoreMemoryStorage] No events found:', {
          sessionId: config.sessionId,
        });
        return [];
      }

      logger.info('[AgentCoreMemoryStorage] Fetched all events:', {
        sessionId: config.sessionId,
        totalEvents: allEvents.length,
      });

      // Events を時系列順にソート
      const sortedEvents = allEvents.sort((a, b) => {
        const timestampA = a.eventTimestamp ? new Date(a.eventTimestamp).getTime() : 0;
        const timestampB = b.eventTimestamp ? new Date(b.eventTimestamp).getTime() : 0;
        return timestampA - timestampB;
      });

      // Events から Message に変換
      const messages: Message[] = [];

      for (const event of sortedEvents) {
        if (event.payload && event.payload.length > 0) {
          // 1つのイベント内の複数のpayloadを統合して1つのメッセージにする
          const consolidatedMessage = this.consolidateEventPayloads(event.payload);
          if (consolidatedMessage) {
            messages.push(consolidatedMessage);
          }
        }
      }

      logger.info('[AgentCoreMemoryStorage] Loaded messages:', {
        sessionId: config.sessionId,
        messageCount: messages.length,
      });
      return messages;
    } catch (error) {
      logger.error('[AgentCoreMemoryStorage] Error loading messages:', {
        sessionId: config.sessionId,
        error,
      });
      throw error;
    }
  }

  /**
   * 指定されたセッションに会話履歴を保存する
   * @param config セッション設定
   * @param messages 保存する Message 配列
   */
  async saveMessages(config: SessionConfig, messages: Message[]): Promise<void> {
    try {
      logger.info('[AgentCoreMemoryStorage] Saving messages:', {
        sessionId: config.sessionId,
        totalMessages: messages.length,
      });

      // 既存のメッセージ数を取得
      const existingMessages = await this.loadMessages(config);
      const existingCount = existingMessages.length;

      // 新規メッセージのみを抽出
      const newMessages = messages.slice(existingCount);

      if (newMessages.length === 0) {
        logger.info('[AgentCoreMemoryStorage] No new messages to save:', {
          sessionId: config.sessionId,
        });
        return;
      }

      logger.info('[AgentCoreMemoryStorage] Saving new messages:', {
        sessionId: config.sessionId,
        newMessageCount: newMessages.length,
      });

      // 各メッセージを個別のイベントとして保存
      for (const message of newMessages) {
        await this.createMessageEvent(config, message);
      }
    } catch (error) {
      logger.error('[AgentCoreMemoryStorage] Error saving messages:', {
        sessionId: config.sessionId,
        error,
      });
      throw error;
    }
  }

  /**
   * 指定されたセッションの履歴をクリアする
   * @param config セッション設定
   */
  async clearSession(config: SessionConfig): Promise<void> {
    try {
      logger.info('[AgentCoreMemoryStorage] Clearing session:', {
        sessionId: config.sessionId,
      });

      // ページネーション対応：すべてのイベントを取得
      const allEvents = [];
      const paginator = paginateListEvents(
        { client: this.client },
        {
          memoryId: this.memoryId,
          actorId: config.actorId,
          sessionId: config.sessionId,
          includePayloads: false, // イベントIDのみ取得
          maxResults: 100,
        }
      );

      for await (const page of paginator) {
        if (page.events) {
          allEvents.push(...page.events);
        }
      }

      if (allEvents.length === 0) {
        logger.info('[AgentCoreMemoryStorage] No events to delete:', {
          sessionId: config.sessionId,
        });
        return;
      }

      logger.info('[AgentCoreMemoryStorage] Deleting events:', {
        sessionId: config.sessionId,
        eventCount: allEvents.length,
      });

      // 各イベントを個別に削除
      for (const event of allEvents) {
        const eventId = extractEventId(event);
        if (eventId) {
          await this.deleteEvent(config, eventId);
        }
      }
    } catch (error) {
      logger.error('[AgentCoreMemoryStorage] Error clearing session:', {
        sessionId: config.sessionId,
        error,
      });
      throw error;
    }
  }

  /**
   * 単一メッセージをイベントとして作成
   * @param config セッション設定
   * @param message 保存するメッセージ
   * @private
   */
  private async createMessageEvent(config: SessionConfig, message: Message): Promise<void> {
    const payload = messageToAgentCorePayload(message);

    const command = new CreateEventCommand({
      memoryId: this.memoryId,
      actorId: config.actorId,
      sessionId: config.sessionId,
      eventTimestamp: getCurrentTimestamp(),
      payload: [payload as PayloadType], // AWS SDK の PayloadType との型互換性のため
    });

    const response = await this.client.send(command);
    logger.info('[AgentCoreMemoryStorage] Created event:', {
      eventId: response.event?.eventId,
      messageRole: message.role,
    });
  }

  /**
   * 指定されたセッションに単一のメッセージを追加保存する
   * ストリーミング中のリアルタイム保存用
   * @param config セッション設定
   * @param message 追加するメッセージ
   */
  async appendMessage(config: SessionConfig, message: Message): Promise<void> {
    try {
      logger.info('[AgentCoreMemoryStorage] Appending message:', {
        sessionId: config.sessionId,
        messageRole: message.role,
      });

      await this.createMessageEvent(config, message);
    } catch (error) {
      logger.error('[AgentCoreMemoryStorage] Error appending message:', {
        sessionId: config.sessionId,
        error,
      });
      throw error;
    }
  }

  /**
   * イベント内の複数のpayloadを統合して1つのメッセージにする
   * @param payloads イベント内のpayload配列
   * @returns 統合されたMessage、または統合できない場合はnull
   * @private
   */
  private consolidateEventPayloads(payloads: PayloadType[]): Message | null {
    if (payloads.length === 0) return null;

    // 各payloadをメッセージに変換
    const messages: Message[] = [];
    for (const payloadItem of payloads) {
      if ('conversational' in payloadItem || 'blob' in payloadItem) {
        const agentCorePayload = payloadItem as AgentCorePayload;
        const message = agentCorePayloadToMessage(agentCorePayload);
        messages.push(message);
      }
    }

    if (messages.length === 0) return null;
    if (messages.length === 1) return messages[0];

    // 複数のメッセージを統合
    // 同じロールのメッセージのcontentを結合する
    const firstMessage = messages[0];
    const role = firstMessage.role;

    // 全てのメッセージが同じロールであることを確認
    const allSameRole = messages.every((msg) => msg.role === role);
    if (!allSameRole) {
      logger.warn('[AgentCoreMemoryStorage] Event contains mixed roles, using first message only');
      return firstMessage;
    }

    // 全てのcontentを結合
    const consolidatedContent = messages.flatMap((msg) => msg.content);

    logger.info('[AgentCoreMemoryStorage] Consolidated event payloads:', {
      role,
      payloadCount: payloads.length,
      contentBlockCount: consolidatedContent.length,
    });

    return new Message({
      role,
      content: consolidatedContent,
    });
  }

  /**
   * 指定されたイベントを削除
   * @param config セッション設定
   * @param eventId 削除するイベントID
   * @private
   */
  private async deleteEvent(config: SessionConfig, eventId: string): Promise<void> {
    const command = new DeleteEventCommand({
      memoryId: this.memoryId,
      actorId: config.actorId,
      sessionId: config.sessionId,
      eventId: eventId,
    });

    await this.client.send(command);
    logger.info('[AgentCoreMemoryStorage] Deleted event:', { eventId });
  }
}
