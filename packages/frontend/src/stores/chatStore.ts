import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import type { ChatState, Message } from '../types/index';
import { streamAgentResponse } from '../api/agent';
import type { ConversationMessage } from '../api/sessions';

// React Router のナビゲート関数を格納する変数
let navigateFunction: ((to: string, options?: { replace?: boolean }) => void) | null = null;

// ナビゲート関数を設定するヘルパー関数
export const setNavigateFunction = (
  navigate: (to: string, options?: { replace?: boolean }) => void
) => {
  navigateFunction = navigate;
};

interface ChatActions {
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => string;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  sendPrompt: (prompt: string) => Promise<void>;
  clearMessages: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  setSessionId: (sessionId: string | null) => void;
  loadSessionHistory: (conversationMessages: ConversationMessage[]) => void;
}

type ChatStore = ChatState & ChatActions;

export const useChatStore = create<ChatStore>()(
  devtools(
    (set, get) => ({
      // State
      messages: [],
      isLoading: false,
      error: null,
      sessionId: null,

      // Actions
      addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => {
        const newMessage: Message = {
          ...message,
          id: nanoid(),
          timestamp: new Date(),
        };

        set((state) => ({
          messages: [...state.messages, newMessage],
        }));

        return newMessage.id;
      },

      updateMessage: (id: string, updates: Partial<Message>) => {
        set((state) => ({
          messages: state.messages.map((msg) => (msg.id === id ? { ...msg, ...updates } : msg)),
        }));
      },

      sendPrompt: async (prompt: string) => {
        const { addMessage, updateMessage } = get();
        let { sessionId } = get();

        // セッションIDがない場合は新しく生成（初回メッセージ送信時）
        if (!sessionId) {
          sessionId = nanoid(33);
          set({ sessionId });

          // URL を更新して sessionId を反映
          if (navigateFunction) {
            console.log(`🆕 新しいセッションを作成: ${sessionId}`);
            navigateFunction(`/chat/${sessionId}`, { replace: true });
          }
        }

        try {
          set({ isLoading: true, error: null });

          // ユーザーメッセージを追加
          addMessage({
            type: 'user',
            content: prompt,
          });

          // アシスタントの応答メッセージを作成（ストリーミング用）
          const assistantMessageId = addMessage({
            type: 'assistant',
            content: '',
            isStreaming: true,
          });

          let accumulatedContent = '';

          // ストリーミングレスポンスを処理
          await streamAgentResponse(prompt, sessionId, {
            onTextDelta: (text: string) => {
              accumulatedContent += text;
              updateMessage(assistantMessageId, {
                content: accumulatedContent,
                isStreaming: true,
              });
            },
            onComplete: () => {
              updateMessage(assistantMessageId, {
                isStreaming: false,
              });

              set({ isLoading: false });
              console.log(`✅ メッセージ送信完了 (セッション: ${sessionId})`);
            },
            onError: (error: Error) => {
              // エラーメッセージで更新
              updateMessage(assistantMessageId, {
                content: `エラーが発生しました: ${error.message}`,
                isStreaming: false,
              });

              set({
                isLoading: false,
                error: error.message,
              });
            },
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'メッセージの送信に失敗しました';
          set({
            isLoading: false,
            error: errorMessage,
          });
        }
      },

      clearMessages: () => {
        set({
          messages: [],
          // sessionId は URL から管理されるためクリアしない
        });
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      setError: (error: string | null) => {
        set({ error });
      },

      clearError: () => {
        set({ error: null });
      },

      setSessionId: (sessionId: string | null) => {
        set({ sessionId });
      },

      loadSessionHistory: (conversationMessages: ConversationMessage[]) => {
        console.log(`📖 会話履歴を復元中: ${conversationMessages.length}件のメッセージ`);

        // ConversationMessage を Message 型に変換
        const messages: Message[] = conversationMessages.map((convMsg) => ({
          id: convMsg.id,
          type: convMsg.type,
          content: convMsg.content,
          timestamp: new Date(convMsg.timestamp),
          isStreaming: false, // 履歴データはストリーミング中ではない
        }));

        set({
          messages,
          error: null, // エラーをクリア
        });

        console.log(`✅ 会話履歴の復元完了: ${messages.length}件のメッセージ`);
      },
    }),
    {
      name: 'chat-store',
    }
  )
);
