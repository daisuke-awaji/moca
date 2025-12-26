import { MCPToolDefinition } from '../schemas/types.js';
import { generateDefaultContext } from './default-context.js';
import { WORKSPACE_DIRECTORY } from '../config/index.js';

export interface SystemPromptOptions {
  customPrompt?: string;
  tools: Array<{ name: string; description?: string }>;
  mcpTools: MCPToolDefinition[];
  storagePath?: string;
  longTermMemories?: string[]; // 長期記憶の配列
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

  // 長期記憶情報を追加（長期記憶がある場合）
  if (options.longTermMemories && options.longTermMemories.length > 0) {
    basePrompt += `

## User Context (Long-term Memory)
Below is what you've learned about this user in the past, so you can tailor your responses to their preferences and circumstances.
${options.longTermMemories.map((memory, index) => `${index + 1}. ${memory}`).join('\n')}
`;
  }

  // ワークスペースとストレージパス情報を追加
  if (options.storagePath) {
    basePrompt += `

## Workspace and Storage
Your workspace is synchronized with the user's S3 storage at path "${options.storagePath}".

### Working Directory
- Default working directory: ${WORKSPACE_DIRECTORY}
- All commands (execute_command) run from ${WORKSPACE_DIRECTORY} by default
- Files from S3 are automatically synced to this directory

### File Operations
When you create or edit files:
1. Use ${WORKSPACE_DIRECTORY} as your working directory (this is the default)
2. Files are automatically uploaded to S3 after tool execution
3. No need to manually use S3 upload tools - changes sync automatically
4. When using execute_command, you don't need to specify workingDirectory

### S3 Tools (Optional)
You can still use S3 tools for specific operations:
- s3_list_files: List files in "${options.storagePath}"
- s3_download_file: Download specific files
- s3_upload_file: Upload files explicitly
- s3_get_presigned_urls: Get temporary download URLs

The workspace sync handles most file operations automatically, making your workflow seamless.`;
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
