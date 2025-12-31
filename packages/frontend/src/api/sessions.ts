/**
 * セッション管理 API クライアント
 * Backend のセッション API を呼び出すためのクライアント
 */

import { backendGet } from './client/backend-client';

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
 * セッション一覧を取得
 * @returns セッション一覧
 */
export async function fetchSessions(): Promise<SessionSummary[]> {
  const data = await backendGet<SessionsResponse>('/sessions');
  return data.sessions;
}

/**
 * セッションの会話履歴を取得
 * @param sessionId セッションID
 * @returns 会話履歴
 */
export async function fetchSessionEvents(sessionId: string): Promise<ConversationMessage[]> {
  const data = await backendGet<SessionEventsResponse>(`/sessions/${sessionId}/events`);
  return data.events;
}
