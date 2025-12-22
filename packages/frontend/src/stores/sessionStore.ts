/**
 * セッション管理ストア
 * セッション一覧とアクティブセッションの状態管理
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { User } from '../types/index';
import {
  fetchSessions,
  fetchSessionEvents,
  type SessionSummary,
  type ConversationMessage,
} from '../api/sessions';

/**
 * セッションストアの状態型定義
 */
interface SessionState {
  sessions: SessionSummary[];
  isLoadingSessions: boolean;
  sessionsError: string | null;
  hasLoadedOnce: boolean; // 初回読み込み完了フラグ

  activeSessionId: string | null;
  sessionEvents: ConversationMessage[];
  isLoadingEvents: boolean;
  eventsError: string | null;
}

/**
 * セッションストアのアクション型定義
 */
interface SessionActions {
  loadSessions: (user: User) => Promise<void>;
  selectSession: (user: User, sessionId: string) => Promise<void>;
  clearActiveSession: () => void;
  setSessionsError: (error: string | null) => void;
  setEventsError: (error: string | null) => void;
  clearErrors: () => void;
  refreshSessions: (user: User) => Promise<void>;
}

/**
 * セッション管理ストア
 */
type SessionStore = SessionState & SessionActions;

export const useSessionStore = create<SessionStore>()(
  devtools(
    (set, get) => ({
      // State
      sessions: [],
      isLoadingSessions: false,
      sessionsError: null,
      hasLoadedOnce: false, // 初回読み込み完了フラグ

      activeSessionId: null,
      sessionEvents: [],
      isLoadingEvents: false,
      eventsError: null,

      // Actions
      loadSessions: async (user: User) => {
        try {
          set({ isLoadingSessions: true, sessionsError: null });

          console.log('🔄 セッション一覧読み込み開始...');
          const sessions = await fetchSessions(user);

          set({
            sessions,
            isLoadingSessions: false,
            sessionsError: null,
            hasLoadedOnce: true, // 初回読み込み完了フラグを設定
          });

          console.log(`✅ セッション一覧読み込み完了: ${sessions.length}件`);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'セッション一覧の読み込みに失敗しました';
          console.error('💥 セッション一覧読み込みエラー:', error);

          set({
            sessions: [],
            isLoadingSessions: false,
            sessionsError: errorMessage,
            hasLoadedOnce: true, // エラーでも初回読み込み完了とマーク
          });
        }
      },

      selectSession: async (user: User, sessionId: string) => {
        try {
          set({
            isLoadingEvents: true,
            eventsError: null,
            activeSessionId: sessionId,
          });

          console.log(`🔄 セッション選択: ${sessionId}`);
          const events = await fetchSessionEvents(user, sessionId);

          set({
            sessionEvents: events,
            isLoadingEvents: false,
            eventsError: null,
          });

          console.log(`✅ セッション会話履歴読み込み完了: ${events.length}件`);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'セッション会話履歴の読み込みに失敗しました';
          console.error('💥 セッション会話履歴読み込みエラー:', error);

          set({
            sessionEvents: [],
            isLoadingEvents: false,
            eventsError: errorMessage,
          });
        }
      },

      clearActiveSession: () => {
        set({
          activeSessionId: null,
          sessionEvents: [],
          eventsError: null,
          isLoadingEvents: false, // 新しいチャット時はローディング状態を明示的にクリア
        });
        console.log('🗑️ アクティブセッションをクリアしました');
      },

      setSessionsError: (error: string | null) => {
        set({ sessionsError: error });
      },

      setEventsError: (error: string | null) => {
        set({ eventsError: error });
      },

      clearErrors: () => {
        set({
          sessionsError: null,
          eventsError: null,
        });
      },

      refreshSessions: async (user: User) => {
        const { loadSessions } = get();
        console.log('🔄 セッション一覧を更新中...');
        await loadSessions(user);
      },
    }),
    {
      name: 'session-store',
    }
  )
);

/**
 * セッション関連のセレクタ（便利関数）
 */
export const sessionSelectors = {
  /**
   * 指定されたセッションIDのセッション情報を取得
   */
  getSessionById: (sessionId: string) => {
    const { sessions } = useSessionStore.getState();
    return sessions.find((session) => session.sessionId === sessionId);
  },

  /**
   * セッション読み込み中かどうかを判定
   */
  isAnyLoading: () => {
    const { isLoadingSessions, isLoadingEvents } = useSessionStore.getState();
    return isLoadingSessions || isLoadingEvents;
  },

  /**
   * エラーがあるかどうかを判定
   */
  hasAnyError: () => {
    const { sessionsError, eventsError } = useSessionStore.getState();
    return !!sessionsError || !!eventsError;
  },

  /**
   * すべてのエラーメッセージを配列で取得
   */
  getAllErrors: () => {
    const { sessionsError, eventsError } = useSessionStore.getState();
    return [sessionsError, eventsError].filter(Boolean) as string[];
  },
};
