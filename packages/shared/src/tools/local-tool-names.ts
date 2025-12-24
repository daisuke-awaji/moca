/**
 * Local Tool Names - Type-safe tool name constants
 *
 * This module provides type-safe constants for all local tools.
 * Use these constants instead of string literals to prevent typos and ensure consistency
 * across frontend, backend, and agent packages.
 */

/**
 * ローカルツール名の定数定義
 *
 * 全てのローカルツール（Agent内蔵ツール）の名前を一元管理します。
 * 新しいツールを追加する際は、ここに定数を追加してください。
 */
export const LOCAL_TOOL_NAMES = {
  // コマンド実行
  EXECUTE_COMMAND: 'execute_command',

  // Tavily Web検索
  TAVILY_SEARCH: 'tavily_search',
  TAVILY_EXTRACT: 'tavily_extract',
  TAVILY_CRAWL: 'tavily_crawl',

  // コードインタープリター
  CODE_INTERPRETER: 'code_interpreter',

  // S3 ストレージ
  S3_LIST_FILES: 's3_list_files',
  S3_DOWNLOAD_FILE: 's3_download_file',
  S3_UPLOAD_FILE: 's3_upload_file',
  S3_GET_PRESIGNED_URLS: 's3_get_presigned_urls',
  S3_SYNC_FOLDER: 's3_sync_folder',
} as const;

/**
 * ローカルツール名の型
 *
 * LOCAL_TOOL_NAMES の値を型として使用します。
 * 例: 'execute_command' | 'tavily_search' | ...
 */
export type LocalToolName = (typeof LOCAL_TOOL_NAMES)[keyof typeof LOCAL_TOOL_NAMES];

/**
 * S3関連ツール名のサブセット
 *
 * S3ストレージ機能に関連するツールのみを抽出した配列です。
 * default-context.ts などでS3ツールの有効性チェックに使用します。
 */
export const S3_TOOL_NAMES = [
  LOCAL_TOOL_NAMES.S3_LIST_FILES,
  LOCAL_TOOL_NAMES.S3_DOWNLOAD_FILE,
  LOCAL_TOOL_NAMES.S3_UPLOAD_FILE,
  LOCAL_TOOL_NAMES.S3_GET_PRESIGNED_URLS,
  LOCAL_TOOL_NAMES.S3_SYNC_FOLDER,
] as const;

/**
 * S3ツール名の型
 *
 * S3関連ツールのみの型です。
 * 例: 's3_list_files' | 's3_download_file' | ...
 */
export type S3ToolName = (typeof S3_TOOL_NAMES)[number];

/**
 * Tavilyツール名のサブセット
 */
export const TAVILY_TOOL_NAMES = [
  LOCAL_TOOL_NAMES.TAVILY_SEARCH,
  LOCAL_TOOL_NAMES.TAVILY_EXTRACT,
  LOCAL_TOOL_NAMES.TAVILY_CRAWL,
] as const;

/**
 * Tavilyツール名の型
 */
export type TavilyToolName = (typeof TAVILY_TOOL_NAMES)[number];

/**
 * 全ローカルツール名の配列
 *
 * すべてのローカルツール名を配列として提供します。
 * ツールの一覧表示や検証に使用できます。
 */
export const ALL_LOCAL_TOOL_NAMES = Object.values(LOCAL_TOOL_NAMES);

/**
 * ツール名が有効なローカルツールかどうかをチェック
 */
export function isLocalToolName(name: string): name is LocalToolName {
  return ALL_LOCAL_TOOL_NAMES.includes(name as LocalToolName);
}

/**
 * ツール名がS3関連ツールかどうかをチェック
 */
export function isS3ToolName(name: string): name is S3ToolName {
  return S3_TOOL_NAMES.includes(name as S3ToolName);
}

/**
 * ツール名がTavily関連ツールかどうかをチェック
 */
export function isTavilyToolName(name: string): name is TavilyToolName {
  return TAVILY_TOOL_NAMES.includes(name as TavilyToolName);
}
