import { MCPToolDefinition } from '../schemas/types.js';
import { generateDefaultContext } from './default-context.js';

export interface SystemPromptOptions {
  customPrompt?: string;
  tools: Array<{ name: string; description?: string }>;
  mcpTools: MCPToolDefinition[];
  storagePath?: string;
}

/**
 * システムプロンプトを生成
 */
export function buildSystemPrompt(options: SystemPromptOptions): string {
  let basePrompt: string;

  if (options.customPrompt) {
    basePrompt = options.customPrompt;
  } else {
    // デフォルトプロンプト生成ロジック
    basePrompt = generateDefaultSystemPrompt(options.tools, options.mcpTools);
  }

  // ストレージパス情報を追加（ルート以外の場合）
  if (options.storagePath && options.storagePath !== '/') {
    basePrompt += `

## User Storage Path Restriction
The user has selected the "${options.storagePath}" directory as their working storage.
When using S3 tools (s3_list_files, s3_download_file, s3_upload_file, s3_get_presigned_urls), 
please specify paths within this directory:

- To list files: Use path="${options.storagePath}"
- To access files: Use "${options.storagePath}/filename.txt" format
- Do NOT use path="/" or paths outside "${options.storagePath}"

This restriction ensures you only access files within the user's selected directory.`;
  }

  // デフォルトコンテキストを付与
  return basePrompt + generateDefaultContext(options.tools, options.mcpTools);
}

/**
 * デフォルトシステムプロンプトを生成
 */
function generateDefaultSystemPrompt(
  _tools: Array<{ name: string; description?: string }>,
  _mcpTools: MCPToolDefinition[]
): string {
  return `You are an AI assistant running on AgentCore Runtime.

Please respond to user questions politely and call appropriate tools as needed.
Explain technical content in an easy-to-understand manner.`;
}
