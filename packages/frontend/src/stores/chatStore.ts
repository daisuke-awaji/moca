import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import type {
  ChatState,
  SessionChatState,
  Message,
  MessageContent,
  ToolUse,
  ToolResult,
} from '../types/index';
import { streamAgentResponse } from '../api/agent';
import type { ConversationMessage } from '../api/sessions';
import { useAgentStore } from './agentStore';
import { useStorageStore } from './storageStore';
import { useSessionStore } from './sessionStore';
import { useMemoryStore } from './memoryStore';
import { useSettingsStore } from './settingsStore';

// ヘルパー関数: 文字列コンテンツをMessageContent配列に変換
const stringToContents = (text: string): MessageContent[] => {
  return text ? [{ type: 'text', text }] : [];
};

// ヘルパー関数: MessageContentを追加
const addContentToMessage = (
  contents: MessageContent[],
  newContent: MessageContent
): MessageContent[] => {
  return [...contents, newContent];
};

// ヘルパー関数: テキストコンテンツを更新または追加
const updateOrAddTextContent = (contents: MessageContent[], text: string): MessageContent[] => {
  // contentsが空の場合、新しいテキストブロックを追加
  if (contents.length === 0) {
    return [{ type: 'text', text }];
  }

  const lastContent = contents[contents.length - 1];

  // 最後がテキストブロックの場合のみ更新（ストリーミング継続）
  if (lastContent.type === 'text') {
    const updated = [...contents];
    updated[contents.length - 1] = { type: 'text', text };
    return updated;
  }

  // 最後がtoolUseまたはtoolResultの場合は新しいテキストブロックを追加
  return [...contents, { type: 'text', text }];
};

// ヘルパー関数: ToolUseのステータスを更新
const updateToolUseStatus = (
  contents: MessageContent[],
  toolUseId: string,
  status: ToolUse['status']
): MessageContent[] => {
  return contents.map((content) => {
    if (content.type === 'toolUse' && content.toolUse) {
      // 実際のtoolUseIdまたはローカルIDで一致確認
      if (content.toolUse.id === toolUseId || content.toolUse.originalToolUseId === toolUseId) {
        return {
          ...content,
          toolUse: {
            ...content.toolUse,
            status,
          },
        };
      }
    }
    return content;
  });
};

// ヘルパー関数: デフォルトのセッション状態を作成
const createDefaultSessionState = (): SessionChatState => ({
  messages: [],
  isLoading: false,
  error: null,
  lastUpdated: new Date(),
});

// ヘルパー関数: セッション状態を取得（存在しない場合は作成）
const getOrCreateSessionState = (
  sessions: Record<string, SessionChatState>,
  sessionId: string
): SessionChatState => {
  if (!sessions[sessionId]) {
    return createDefaultSessionState();
  }
  return sessions[sessionId];
};

interface ChatActions {
  getSessionState: (sessionId: string) => SessionChatState;
  getActiveSessionState: () => SessionChatState | null;
  switchSession: (sessionId: string) => void;
  addMessage: (sessionId: string, message: Omit<Message, 'id' | 'timestamp'>) => string;
  updateMessage: (sessionId: string, messageId: string, updates: Partial<Message>) => void;
  sendPrompt: (prompt: string, sessionId: string) => Promise<void>;
  clearSession: (sessionId: string) => void;
  setLoading: (sessionId: string, loading: boolean) => void;
  setError: (sessionId: string, error: string | null) => void;
  clearError: (sessionId: string) => void;
  loadSessionHistory: (sessionId: string, conversationMessages: ConversationMessage[]) => void;
}

type ChatStore = ChatState & ChatActions;

export const useChatStore = create<ChatStore>()(
  devtools(
    (set, get) => ({
      // State
      sessions: {},
      activeSessionId: null,

      // Actions
      getSessionState: (sessionId: string) => {
        const { sessions } = get();
        return getOrCreateSessionState(sessions, sessionId);
      },

      getActiveSessionState: () => {
        const { sessions, activeSessionId } = get();
        if (!activeSessionId) return null;
        return getOrCreateSessionState(sessions, activeSessionId);
      },

      switchSession: (sessionId: string) => {
        set({ activeSessionId: sessionId });

        // セッション状態が存在しない場合は初期化
        const { sessions } = get();
        if (!sessions[sessionId]) {
          set({
            sessions: {
              ...sessions,
              [sessionId]: createDefaultSessionState(),
            },
          });
        }
        console.log(`🔄 セッション切り替え: ${sessionId}`);
      },

      addMessage: (sessionId: string, message: Omit<Message, 'id' | 'timestamp'>) => {
        const newMessage: Message = {
          ...message,
          id: nanoid(),
          timestamp: new Date(),
        };

        const { sessions } = get();
        const sessionState = getOrCreateSessionState(sessions, sessionId);

        set({
          sessions: {
            ...sessions,
            [sessionId]: {
              ...sessionState,
              messages: [...sessionState.messages, newMessage],
              lastUpdated: new Date(),
            },
          },
        });

        return newMessage.id;
      },

      updateMessage: (sessionId: string, messageId: string, updates: Partial<Message>) => {
        const { sessions } = get();
        const sessionState = getOrCreateSessionState(sessions, sessionId);

        set({
          sessions: {
            ...sessions,
            [sessionId]: {
              ...sessionState,
              messages: sessionState.messages.map((msg) =>
                msg.id === messageId ? { ...msg, ...updates } : msg
              ),
              lastUpdated: new Date(),
            },
          },
        });
      },

      sendPrompt: async (prompt: string, sessionId: string) => {
        const { addMessage, updateMessage, sessions } = get();

        // セッション状態の取得/作成
        const sessionState = getOrCreateSessionState(sessions, sessionId);

        // ローディング状態を設定
        set({
          sessions: {
            ...sessions,
            [sessionId]: {
              ...sessionState,
              isLoading: true,
              error: null,
            },
          },
        });

        // 新規セッションかどうかを判定（セッション一覧更新に使用）
        const sessionsStore = useSessionStore.getState().sessions;
        const isNewSession = !sessionsStore.some((s) => s.sessionId === sessionId);

        try {
          // ユーザーメッセージを追加
          addMessage(sessionId, {
            type: 'user',
            contents: stringToContents(prompt),
          });

          // アシスタントの応答メッセージを作成（ストリーミング用）
          const assistantMessageId = addMessage(sessionId, {
            type: 'assistant',
            contents: [],
            isStreaming: true,
          });

          let accumulatedContent = '';
          let isAfterToolExecution = false;

          // 選択中のエージェント設定を取得
          const selectedAgent = useAgentStore.getState().selectedAgent;

          // ストレージパスを取得
          const currentPath = useStorageStore.getState().currentPath;

          // 長期記憶設定を取得
          const { isMemoryEnabled } = useMemoryStore.getState();

          // 選択中のモデルIDを取得
          const { selectedModelId } = useSettingsStore.getState();

          const agentConfig = selectedAgent
            ? {
                modelId: selectedModelId,
                systemPrompt: selectedAgent.systemPrompt,
                enabledTools: selectedAgent.enabledTools,
                storagePath: currentPath,
                memoryEnabled: isMemoryEnabled,
                mcpConfig: selectedAgent.mcpConfig as Record<string, unknown> | undefined,
              }
            : {
                modelId: selectedModelId,
                storagePath: currentPath,
                memoryEnabled: isMemoryEnabled,
              };

          // デバッグログ
          if (selectedAgent) {
            console.log(`🤖 選択エージェント: ${selectedAgent.name}`);
            console.log(`🔧 有効ツール: ${selectedAgent.enabledTools.join(', ') || 'なし'}`);
          } else {
            console.log(`🤖 デフォルトエージェント使用`);
          }
          console.log(`📁 ストレージパス制限: ${currentPath}`);

          // ストリーミングレスポンスを処理
          await streamAgentResponse(
            prompt,
            sessionId,
            {
              onTextDelta: (text: string) => {
                // セッションIDでスコープを限定
                const { activeSessionId } = get();

                // アクティブセッションが切り替わっていたら更新をスキップ
                if (activeSessionId !== sessionId) {
                  console.log(
                    `⚠️ セッション切り替え検出 (${sessionId} → ${activeSessionId})、更新をスキップ`
                  );
                  return;
                }

                // ツール実行後の最初のテキストの場合、新しいテキストブロック開始
                if (isAfterToolExecution) {
                  accumulatedContent = text;
                  isAfterToolExecution = false;
                } else {
                  accumulatedContent += text;
                }

                const { sessions } = get();
                const sessionState = sessions[sessionId];
                if (!sessionState) return;

                const currentMessage = sessionState.messages.find(
                  (msg) => msg.id === assistantMessageId
                );

                if (currentMessage) {
                  // 既存のcontentsを保持しつつテキストを更新
                  const newContents = updateOrAddTextContent(
                    currentMessage.contents,
                    accumulatedContent
                  );
                  updateMessage(sessionId, assistantMessageId, {
                    contents: newContents,
                    isStreaming: true,
                  });
                }
              },
              onToolUse: (toolUse: ToolUse) => {
                const { activeSessionId, sessions } = get();
                if (activeSessionId !== sessionId) return;

                // ツール使用を追加
                const sessionState = sessions[sessionId];
                if (!sessionState) return;

                const currentMessage = sessionState.messages.find(
                  (msg) => msg.id === assistantMessageId
                );
                if (currentMessage) {
                  const newContents = addContentToMessage(currentMessage.contents, {
                    type: 'toolUse',
                    toolUse,
                  });
                  updateMessage(sessionId, assistantMessageId, {
                    contents: newContents,
                  });
                }
              },
              onToolInputUpdate: (toolUseId: string, input: Record<string, unknown>) => {
                const { activeSessionId, sessions } = get();
                if (activeSessionId !== sessionId) return;

                // ツール入力パラメータを更新
                const sessionState = sessions[sessionId];
                if (!sessionState) return;

                const currentMessage = sessionState.messages.find(
                  (msg) => msg.id === assistantMessageId
                );
                if (currentMessage) {
                  const updatedContents = currentMessage.contents.map((content) => {
                    if (content.type === 'toolUse' && content.toolUse) {
                      // originalToolUseIdまたはローカルIDで一致確認
                      if (
                        content.toolUse.originalToolUseId === toolUseId ||
                        content.toolUse.id === toolUseId
                      ) {
                        return {
                          ...content,
                          toolUse: {
                            ...content.toolUse,
                            input,
                          },
                        };
                      }
                    }
                    return content;
                  });

                  updateMessage(sessionId, assistantMessageId, {
                    contents: updatedContents,
                  });
                }
              },
              onToolResult: (toolResult: ToolResult) => {
                const { activeSessionId, sessions } = get();
                if (activeSessionId !== sessionId) return;

                // ツール結果を追加
                const sessionState = sessions[sessionId];
                if (!sessionState) return;

                const currentMessage = sessionState.messages.find(
                  (msg) => msg.id === assistantMessageId
                );
                if (currentMessage) {
                  // ToolUseのステータスを完了に更新
                  const updatedContentsWithStatus = updateToolUseStatus(
                    currentMessage.contents,
                    toolResult.toolUseId,
                    'completed'
                  );

                  // ツール結果を追加
                  const finalContents = addContentToMessage(updatedContentsWithStatus, {
                    type: 'toolResult',
                    toolResult,
                  });

                  updateMessage(sessionId, assistantMessageId, {
                    contents: finalContents,
                  });

                  // ツール実行後フラグを設定（次のテキストは新しいブロックとして開始）
                  isAfterToolExecution = true;
                }
              },
              onComplete: () => {
                updateMessage(sessionId, assistantMessageId, {
                  isStreaming: false,
                });

                const { sessions } = get();
                const currentState = sessions[sessionId] || createDefaultSessionState();

                set({
                  sessions: {
                    ...sessions,
                    [sessionId]: {
                      ...currentState,
                      isLoading: false,
                    },
                  },
                });

                console.log(`✅ メッセージ送信完了 (セッション: ${sessionId})`);

                // 新規セッションの場合、セッション一覧を更新
                if (isNewSession) {
                  console.log('🔄 新規セッション作成完了、セッション一覧を更新中...');
                  useSessionStore.getState().refreshSessions();
                }
              },
              onError: (error: Error) => {
                // エラーメッセージをアシスタントの応答として追加（isErrorフラグ付き）
                const { sessions } = get();
                const sessionState = sessions[sessionId];
                if (!sessionState) return;

                const currentMessage = sessionState.messages.find(
                  (msg) => msg.id === assistantMessageId
                );

                // 既存のcontentsを保持しつつエラーメッセージを追加
                const existingContents = currentMessage?.contents || [];
                const errorContent = {
                  type: 'text' as const,
                  text: `エラーが発生しました: ${error.message}`,
                };

                updateMessage(sessionId, assistantMessageId, {
                  contents: [...existingContents, errorContent],
                  isStreaming: false,
                  isError: true,
                });

                const currentState = sessions[sessionId] || createDefaultSessionState();

                set({
                  sessions: {
                    ...sessions,
                    [sessionId]: {
                      ...currentState,
                      isLoading: false,
                      error: error.message,
                    },
                  },
                });
              },
            },
            agentConfig
          );
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'メッセージの送信に失敗しました';

          const { sessions } = get();
          const currentState = sessions[sessionId] || createDefaultSessionState();

          set({
            sessions: {
              ...sessions,
              [sessionId]: {
                ...currentState,
                isLoading: false,
                error: errorMessage,
              },
            },
          });
        }
      },

      clearSession: (sessionId: string) => {
        const { sessions } = get();
        const newSessions = { ...sessions };
        delete newSessions[sessionId];

        set({ sessions: newSessions });
        console.log(`🗑️ セッションをクリア: ${sessionId}`);
      },

      setLoading: (sessionId: string, loading: boolean) => {
        const { sessions } = get();
        const sessionState = getOrCreateSessionState(sessions, sessionId);

        set({
          sessions: {
            ...sessions,
            [sessionId]: {
              ...sessionState,
              isLoading: loading,
            },
          },
        });
      },

      setError: (sessionId: string, error: string | null) => {
        const { sessions } = get();
        const sessionState = getOrCreateSessionState(sessions, sessionId);

        set({
          sessions: {
            ...sessions,
            [sessionId]: {
              ...sessionState,
              error,
            },
          },
        });
      },

      clearError: (sessionId: string) => {
        const { sessions } = get();
        const sessionState = getOrCreateSessionState(sessions, sessionId);

        set({
          sessions: {
            ...sessions,
            [sessionId]: {
              ...sessionState,
              error: null,
            },
          },
        });
      },

      loadSessionHistory: (sessionId: string, conversationMessages: ConversationMessage[]) => {
        console.log(
          `📖 会話履歴を復元中 (${sessionId}): ${conversationMessages.length}件のメッセージ`
        );

        // Helper function to check if message contains error marker
        const isErrorMessage = (contents: MessageContent[]): boolean => {
          return contents.some(
            (content) =>
              content.type === 'text' &&
              content.text &&
              (content.text.includes('[SYSTEM_ERROR]') ||
                content.text.startsWith('エラーが発生しました:'))
          );
        };

        // ConversationMessage を Message 型に変換
        const messages: Message[] = conversationMessages.map((convMsg) => ({
          id: convMsg.id,
          type: convMsg.type,
          contents: convMsg.contents, // Use contents array as is
          timestamp: new Date(convMsg.timestamp),
          isStreaming: false, // History data is not streaming
          isError: convMsg.type === 'assistant' && isErrorMessage(convMsg.contents), // Detect error message
        }));

        const { sessions } = get();
        set({
          sessions: {
            ...sessions,
            [sessionId]: {
              messages,
              isLoading: false,
              error: null,
              lastUpdated: new Date(),
            },
          },
        });

        console.log(`✅ 会話履歴の復元完了 (${sessionId}): ${messages.length}件のメッセージ`);
      },
    }),
    {
      name: 'chat-store',
    }
  )
);
