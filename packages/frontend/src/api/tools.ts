/**
 * ツール管理 API クライアント
 * Backend のツール API を呼び出すためのクライアント
 */

import { backendGet, backendPost } from './client/backend-client';

/**
 * MCP ツールの型定義
 */
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * ローカルツール定義（エージェント内蔵ツール）
 * AgentCore Gateway ではなく、エージェント内で直接実装されているツール
 */
export const LOCAL_TOOLS: MCPTool[] = [
  {
    name: 'execute_command',
    description:
      'シェルコマンドを実行し、結果を返します。ファイル操作、情報収集、開発タスクの自動化に使用できます。',
    inputSchema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: '実行するシェルコマンド',
        },
        workingDirectory: {
          type: 'string',
          description: '作業ディレクトリ（未指定の場合は現在のディレクトリ）',
        },
        timeout: {
          type: 'number',
          minimum: 1000,
          maximum: 60000,
          default: 30000,
          description: 'タイムアウト（ミリ秒、デフォルト: 30秒、最大: 60秒）',
        },
      },
      required: ['command'],
    },
  },
  {
    name: 'tavily_search',
    description:
      'Tavily APIを使用して高品質なWeb検索を実行します。最新の情報、ニュース、一般的な話題について包括的な検索結果を取得できます。',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '検索クエリ（必須）',
        },
        searchDepth: {
          type: 'string',
          enum: ['basic', 'advanced'],
          default: 'basic',
          description: '検索深度。basicは1クレジット、advancedは2クレジット使用',
        },
        topic: {
          type: 'string',
          enum: ['general', 'news', 'finance'],
          default: 'general',
          description: '検索カテゴリ。newsは最新情報、generalは一般検索',
        },
        maxResults: {
          type: 'number',
          minimum: 1,
          maximum: 20,
          default: 5,
          description: '取得する最大検索結果数（1-20）',
        },
        includeAnswer: {
          type: 'boolean',
          default: true,
          description: 'LLM生成の要約回答を含める',
        },
        timeRange: {
          type: 'string',
          enum: ['day', 'week', 'month', 'year', 'd', 'w', 'm', 'y'],
          description: '時間範囲フィルター（過去の期間で絞り込み）',
        },
        includeDomains: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: '検索対象に含めるドメインのリスト',
        },
        excludeDomains: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: '検索対象から除外するドメインのリスト',
        },
        includeImages: {
          type: 'boolean',
          default: false,
          description: '関連画像も取得する',
        },
        country: {
          type: 'string',
          description: '特定の国の結果を優先（例: japan, united states）',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'tavily_extract',
    description:
      'Tavily APIを使用して指定されたURLからコンテンツを抽出します。Webページの内容を構造化されたテキストとして取得できます。',
    inputSchema: {
      type: 'object',
      properties: {
        urls: {
          oneOf: [
            { type: 'string' },
            {
              type: 'array',
              items: { type: 'string' },
            },
          ],
          description: '抽出対象のURL（単一URLまたはURL配列）',
        },
        query: {
          type: 'string',
          description: 'リランキング用クエリ。指定すると関連性の高いコンテンツが優先されます',
        },
        extractDepth: {
          type: 'string',
          enum: ['basic', 'advanced'],
          default: 'basic',
          description: '抽出深度。basicは1クレジット/5URL、advancedは2クレジット/5URL',
        },
        format: {
          type: 'string',
          enum: ['markdown', 'text'],
          default: 'markdown',
          description: '出力フォーマット。markdownまたはtext',
        },
        chunksPerSource: {
          type: 'number',
          minimum: 1,
          maximum: 5,
          default: 3,
          description: 'ソースあたりのチャンク数（1-5、queryが指定された場合のみ有効）',
        },
        includeImages: {
          type: 'boolean',
          default: false,
          description: '画像情報を含めるかどうか',
        },
        timeout: {
          type: 'number',
          minimum: 1,
          maximum: 60,
          default: 30,
          description: 'タイムアウト（秒、1-60）',
        },
      },
      required: ['urls'],
    },
  },
  {
    name: 'tavily_crawl',
    description:
      'Tavily APIを使用してWebサイトを包括的にクロールします。指定されたルートURLから始まり、関連するページを自動的に発見・抽出します。',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'クロール開始URL',
        },
        instructions: {
          type: 'string',
          description: 'クロールの指示（自然言語）。指定すると使用コストが2倍になります',
        },
        maxDepth: {
          type: 'number',
          minimum: 1,
          maximum: 5,
          default: 1,
          description: '最大探索深度（1-5、ベースURLからどこまで離れるか）',
        },
        maxBreadth: {
          type: 'number',
          minimum: 1,
          default: 20,
          description: 'ページごとの最大リンク数（1以上）',
        },
        limit: {
          type: 'number',
          minimum: 1,
          default: 50,
          description: '処理する最大リンク数（1以上）',
        },
        selectPaths: {
          type: 'array',
          items: { type: 'string' },
          description: '含めるパスの正規表現パターン（例: ["/docs/.*", "/api/v1.*"]）',
        },
        selectDomains: {
          type: 'array',
          items: { type: 'string' },
          description: '含めるドメインの正規表現パターン（例: ["^docs\\.example\\.com$"]）',
        },
        excludePaths: {
          type: 'array',
          items: { type: 'string' },
          description: '除外するパスの正規表現パターン（例: ["/private/.*", "/admin/.*"]）',
        },
        excludeDomains: {
          type: 'array',
          items: { type: 'string' },
          description: '除外するドメインの正規表現パターン（例: ["^private\\.example\\.com$"]）',
        },
        allowExternal: {
          type: 'boolean',
          default: true,
          description: '外部ドメインリンクを結果に含めるかどうか',
        },
        extractDepth: {
          type: 'string',
          enum: ['basic', 'advanced'],
          default: 'basic',
          description: '抽出深度。basicは1クレジット/5抽出、advancedは2クレジット/5抽出',
        },
        format: {
          type: 'string',
          enum: ['markdown', 'text'],
          default: 'markdown',
          description: '出力フォーマット。markdownまたはtext',
        },
        includeImages: {
          type: 'boolean',
          default: false,
          description: '画像情報を含めるかどうか',
        },
        chunksPerSource: {
          type: 'number',
          minimum: 1,
          maximum: 5,
          default: 3,
          description: 'ソースあたりのチャンク数（1-5、instructionsが指定された場合のみ有効）',
        },
        timeout: {
          type: 'number',
          minimum: 10,
          maximum: 150,
          default: 150,
          description: 'タイムアウト（秒、10-150）',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'code_interpreter',
    description:
      'Amazon Bedrock AgentCore CodeInterpreter ツール - セキュアなサンドボックス環境でコード実行やファイル操作を行います。Python、JavaScript、TypeScript のコード実行、シェルコマンド実行、ファイル操作（読み取り、書き込み、削除）、セッション管理などの機能を提供します。',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: [
            'initSession',
            'executeCode',
            'executeCommand',
            'readFiles',
            'listFiles',
            'removeFiles',
            'writeFiles',
            'downloadFiles',
            'listLocalSessions',
          ],
          description: '実行する操作',
        },
        sessionName: {
          type: 'string',
          description: 'セッション名（省略時はデフォルト）',
        },
        description: {
          type: 'string',
          description: 'セッションの説明（initSession時）',
        },
        language: {
          type: 'string',
          enum: ['python', 'javascript', 'typescript'],
          description: 'コード実行時の言語',
        },
        code: {
          type: 'string',
          description: '実行するコード',
        },
        clearContext: {
          type: 'boolean',
          default: false,
          description: 'コンテキストをクリアするか',
        },
        command: {
          type: 'string',
          description: '実行するシェルコマンド',
        },
        paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'ファイルパスの配列',
        },
        path: {
          type: 'string',
          description: 'ディレクトリパス',
        },
        content: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              text: { type: 'string' },
            },
            required: ['path', 'text'],
          },
          description: '書き込むファイルの配列',
        },
        sourcePaths: {
          type: 'array',
          items: { type: 'string' },
          description: 'ダウンロードするファイルパスの配列',
        },
        destinationDir: {
          type: 'string',
          description: 'ダウンロード先ディレクトリ（絶対パス）',
        },
      },
      required: ['action'],
    },
  },
  {
    name: 's3_list_files',
    description:
      'ユーザーのS3ストレージ内のファイルとディレクトリの一覧を取得します。指定されたパス配下のコンテンツを探索できます。',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          default: '/',
          description: '一覧を取得するディレクトリパス（デフォルト: ルート "/"）',
        },
        recursive: {
          type: 'boolean',
          default: false,
          description: '再帰的にサブディレクトリも含めて取得するか（デフォルト: false）',
        },
        maxResults: {
          type: 'number',
          minimum: 1,
          maximum: 1000,
          default: 100,
          description: '取得する最大結果数（1-1000、デフォルト: 100）',
        },
      },
      required: [],
    },
  },
  {
    name: 's3_get_presigned_urls',
    description:
      'ユーザーのS3ストレージ内のファイルに対する署名付きURLを一括で生成します。ダウンロード用またはアップロード用のURLを取得できます。複数のファイルを一度に処理できます。',
    inputSchema: {
      type: 'object',
      properties: {
        paths: {
          oneOf: [
            { type: 'string' },
            {
              type: 'array',
              items: { type: 'string' },
            },
          ],
          description: 'ファイルパス（単一の文字列または文字列の配列）',
        },
        operation: {
          type: 'string',
          enum: ['download', 'upload'],
          default: 'download',
          description: '操作タイプ: "download"（ダウンロード用）または "upload"（アップロード用）',
        },
        expiresIn: {
          type: 'number',
          minimum: 60,
          maximum: 604800,
          default: 3600,
          description:
            '署名付きURLの有効期限（秒）。デフォルト: 3600（1時間）、最大: 604800（7日間）',
        },
        contentType: {
          type: 'string',
          description: 'アップロード操作の場合のContent-Type（オプション）',
        },
      },
      required: ['paths'],
    },
  },
  {
    name: 'file_editor',
    description:
      'ファイルを編集または新規作成します。ファイルの移動や名前変更にはexecute_commandツールでmvコマンドを使用してください。使用前にcatコマンドでファイル内容を確認し、新規ファイルの場合はlsコマンドでディレクトリを確認してください。oldStringで指定したテキストをnewStringで置換します。oldStringはファイル内で一意である必要があり、空白やインデントも含めて完全に一致する必要があります。一度に1箇所のみ変更可能で、複数箇所を変更する場合は複数回呼び出してください。',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: '編集対象ファイルの絶対パス（相対パスは使用不可）',
        },
        oldString: {
          type: 'string',
          description:
            '置換対象のテキスト。ファイル内で一意である必要があり、空白やインデントも含めて完全に一致する必要があります。新規ファイルを作成する場合は空文字列を指定してください。',
        },
        newString: {
          type: 'string',
          description: '置換後のテキスト。新規ファイル作成時はこの内容がファイルに書き込まれます。',
        },
      },
      required: ['filePath', 'oldString', 'newString'],
    },
  },
];

/**
 * API レスポンスの型定義
 */
interface ToolsResponse {
  tools: MCPTool[];
  nextCursor?: string;
  metadata: {
    requestId: string;
    timestamp: string;
    actorId: string;
    count: number;
    query?: string;
  };
}

interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  gateway: {
    connected: boolean;
    endpoint: string;
  };
  metadata: {
    requestId: string;
    timestamp: string;
    actorId: string;
  };
}

/**
 * ツール一覧を取得（ページネーション対応）
 * @param cursor ページネーション用のカーソル（オプショナル）
 * @returns ツール一覧とnextCursor
 */
export async function fetchTools(cursor?: string): Promise<{
  tools: MCPTool[];
  nextCursor?: string;
}> {
  const url = cursor ? `/tools?cursor=${encodeURIComponent(cursor)}` : '/tools';
  const data = await backendGet<ToolsResponse>(url);

  return {
    tools: data.tools,
    nextCursor: data.nextCursor,
  };
}

/**
 * ローカル MCP ツール取得
 * ユーザー定義の MCP サーバー設定からツール一覧を取得
 * @param mcpConfig mcp.json 形式の MCP サーバー設定
 * @returns ツール一覧（サーバー名付き）
 */
export async function fetchLocalMCPTools(
  mcpConfig: Record<string, unknown>
): Promise<(MCPTool & { serverName: string })[]> {
  const data = await backendPost<{ tools: (MCPTool & { serverName: string })[] }>('/tools/local', {
    mcpConfig,
  });

  return data.tools;
}

/**
 * ツールを検索
 * @param query 検索クエリ
 * @returns 検索結果のツール一覧
 */
export async function searchTools(query: string): Promise<MCPTool[]> {
  if (!query || query.trim().length === 0) {
    throw new Error('検索クエリが必要です');
  }

  const data = await backendPost<ToolsResponse>('/tools/search', {
    query: query.trim(),
  });

  return data.tools;
}

/**
 * Gateway 接続状態を確認
 * @returns 接続状態情報
 */
export async function checkGatewayHealth(): Promise<HealthResponse> {
  return backendGet<HealthResponse>('/tools/health');
}
