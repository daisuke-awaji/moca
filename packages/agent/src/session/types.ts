/**
 * セッションタイプ
 * - user: ユーザーによる通常の会話セッション
 * - event: イベント駆動（EventBridge等）による自動実行セッション
 * - subagent: サブエージェントによる委譲実行セッション
 */
export type SessionType = 'user' | 'event' | 'subagent';

/**
 * セッション設定
 * AgentCore Memory の actor_id + session_id パターンに準拠
 */
export interface SessionConfig {
  /** ユーザーを一意に識別する ID (例: "engineer_alice") */
  actorId: string;
  /** セッションを一意に識別する ID (例: "python_study_20250817") */
  sessionId: string;
  /** セッションタイプ (デフォルト: 'user') */
  sessionType?: SessionType;
}

/**
 * セッションストレージのインターフェース
 * 将来的に DynamoDB や AgentCore Memory への置き換えを容易にするための抽象化
 */
export interface SessionStorage {
  /**
   * 指定されたセッションの会話履歴を読み込む
   * @param config セッション設定
   * @returns 会話履歴の Message 配列
   */
  loadMessages(config: SessionConfig): Promise<import('@strands-agents/sdk').Message[]>;

  /**
   * 指定されたセッションに会話履歴を保存する
   * @param config セッション設定
   * @param messages 保存する Message 配列
   */
  saveMessages(
    config: SessionConfig,
    messages: import('@strands-agents/sdk').Message[]
  ): Promise<void>;

  /**
   * 指定されたセッションの履歴をクリアする
   * @param config セッション設定
   */
  clearSession(config: SessionConfig): Promise<void>;

  /**
   * 指定されたセッションに単一のメッセージを追加保存する
   * ストリーミング中のリアルタイム保存用
   * @param config セッション設定
   * @param message 追加するメッセージ
   */
  appendMessage(
    config: SessionConfig,
    message: import('@strands-agents/sdk').Message
  ): Promise<void>;
}
