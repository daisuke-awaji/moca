/**
 * セッション管理 API クライアント
 * Backend のセッション API を呼び出すためのクライアント
 */

import { getValidAccessToken } from '../lib/cognito';

/**
 * セッション情報の型定義
 */
export interface SessionSummary {
  sessionId: string;
  title: string;
  lastMessage: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * ToolUse 型定義（Backend と共通）
 */
export interface ToolUse {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status?: 'pending' | 'running' | 'completed' | 'error';
  originalToolUseId?: string;
}

/**
 * ToolResult 型定義（Backend と共通）
 */
export interface ToolResult {
  toolUseId: string;
  content: string;
  isError: boolean;
}

/**
 * MessageContent 型定義（Union型）
 */
export type MessageContent =
  | { type: 'text'; text: string }
  | { type: 'toolUse'; toolUse: ToolUse }
  | { type: 'toolResult'; toolResult: ToolResult };

/**
 * 会話メッセージの型定義
 */
export interface ConversationMessage {
  id: string;
  type: 'user' | 'assistant';
  contents: MessageContent[];
  timestamp: string;
}

/**
 * API レスポンスの型定義
 */
interface SessionsResponse {
  sessions: SessionSummary[];
  metadata: {
    requestId: string;
    timestamp: string;
    actorId: string;
    count: number;
  };
}

interface SessionEventsResponse {
  events: ConversationMessage[];
  metadata: {
    requestId: string;
    timestamp: string;
    actorId: string;
    sessionId: string;
    count: number;
  };
}

/**
 * Backend API のベース URL を取得
 */
function getBackendBaseUrl(): string {
  // 環境変数から取得、未設定の場合はデフォルト値を使用
  const baseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

  // 末尾のスラッシュを除去してダブルスラッシュ問題を防ぐ
  return baseUrl.replace(/\/$/, '');
}

/**
 * 認証ヘッダーを作成（自動トークンリフレッシュ付き）
 * @returns Authorization ヘッダー
 */
async function createAuthHeaders(): Promise<Record<string, string>> {
  // 有効なアクセストークンを取得（期限切れの場合は自動リフレッシュ）
  const accessToken = await getValidAccessToken();

  if (!accessToken) {
    throw new Error('認証が必要です。再ログインしてください。');
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };
}

/**
 * セッション一覧を取得
 * @returns セッション一覧
 */
export async function fetchSessions(): Promise<SessionSummary[]> {
  try {
    const baseUrl = getBackendBaseUrl();
    const headers = await createAuthHeaders();

    console.log('📋 セッション一覧取得開始...');

    const response = await fetch(`${baseUrl}/sessions`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `セッション一覧の取得に失敗しました: ${response.status} ${response.statusText} - ${
          errorData.message || 'Unknown error'
        }`
      );
    }

    const data: SessionsResponse = await response.json();
    console.log(`✅ セッション一覧取得完了: ${data.sessions.length}件`);

    return data.sessions;
  } catch (error) {
    console.error('💥 セッション一覧取得エラー:', error);
    throw error;
  }
}

/**
 * セッションの会話履歴を取得
 * @param sessionId セッションID
 * @returns 会話履歴
 */
export async function fetchSessionEvents(sessionId: string): Promise<ConversationMessage[]> {
  try {
    const baseUrl = getBackendBaseUrl();
    const headers = await createAuthHeaders();

    console.log(`💬 セッション会話履歴取得開始: ${sessionId}`);

    const response = await fetch(`${baseUrl}/sessions/${sessionId}/events`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `セッション会話履歴の取得に失敗しました: ${response.status} ${response.statusText} - ${
          errorData.message || 'Unknown error'
        }`
      );
    }

    const data: SessionEventsResponse = await response.json();
    console.log(`✅ セッション会話履歴取得完了: ${data.events.length}件`);

    return data.events;
  } catch (error) {
    console.error('💥 セッション会話履歴取得エラー:', error);
    throw error;
  }
}
