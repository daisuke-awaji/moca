/**
 * Agent 関連の型定義
 */

/**
 * MCP サーバー設定
 */
export interface MCPServer {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  transport?: 'stdio' | 'http' | 'sse';
}

/**
 * MCP 設定
 */
export interface MCPConfig {
  mcpServers: Record<string, MCPServer>;
}

export interface Scenario {
  id: string;
  title: string; // シナリオ名（例: 「コードレビュー依頼」）
  prompt: string; // プロンプトテンプレート
}

export interface Agent {
  agentId: string; // Agent ID (UUID or predefined ID like 'web-researcher')
  name: string; // Agent名
  description: string; // 説明
  icon?: string; // lucideアイコン名（例: "Bot", "Code", "Brain"）
  systemPrompt: string; // システムプロンプト
  enabledTools: string[]; // 有効化されたツール名の配列
  scenarios: Scenario[]; // よく使うプロンプト
  mcpConfig?: MCPConfig; // MCP サーバー設定
  createdAt: Date;
  updatedAt: Date;

  // 共有関連
  isShared: boolean; // 共有フラグ（組織全体に公開）
  createdBy: string; // 作成者名（Cognito username）
  userId?: string; // 元のユーザーID（共有エージェントのクローン時に使用）
}

/**
 * Agent作成時の入力データ
 */
export interface CreateAgentInput {
  name: string;
  description: string;
  icon?: string;
  systemPrompt: string;
  enabledTools: string[];
  scenarios: Omit<Scenario, 'id'>[];
  mcpConfig?: MCPConfig;
}

/**
 * Agent更新時の入力データ
 */
export interface UpdateAgentInput extends Partial<CreateAgentInput> {
  agentId: string;
}

/**
 * AgentStore の状態
 */
export interface AgentState {
  agents: Agent[];
  selectedAgent: Agent | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * AgentStore のアクション
 */
export interface AgentActions {
  // Agent CRUD (async)
  createAgent: (input: CreateAgentInput) => Promise<Agent>;
  updateAgent: (input: UpdateAgentInput) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  getAgent: (id: string) => Agent | undefined;

  // Agent共有
  toggleShare: (id: string) => Promise<Agent>;

  // Agent選択
  selectAgent: (agent: Agent | null) => void;

  // 初期化・リセット (async)
  initializeStore: () => Promise<void>;
  clearError: () => void;
}

/**
 * AgentStore の完全な型
 */
export type AgentStore = AgentState & AgentActions;
