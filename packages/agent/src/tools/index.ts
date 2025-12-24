export { executeCommandTool } from './execute-command.js';
export { tavilySearchTool } from './tavily-search.js';
export { tavilyExtractTool } from './tavily-extract.js';
export { tavilyCrawlTool } from './tavily-crawl.js';
export { createStrandsToolFromMCP, convertMCPToolsToStrands } from './mcp-converter.js';
export { codeInterpreterTool } from './code-interpreter/index.js';
export { s3ListFilesTool } from './s3-list-files.js';
export { s3DownloadFileTool } from './s3-download-file.js';
export { s3UploadFileTool } from './s3-upload-file.js';
export { s3GetPresignedUrlsTool } from './s3-get-presigned-urls.js';
export { s3SyncFolderTool } from './s3-sync-folder.js';

// ローカルツール配列のインポート
import { executeCommandTool } from './execute-command.js';
import { tavilySearchTool } from './tavily-search.js';
import { tavilyExtractTool } from './tavily-extract.js';
import { tavilyCrawlTool } from './tavily-crawl.js';
import { codeInterpreterTool } from './code-interpreter/index.js';
import { s3ListFilesTool } from './s3-list-files.js';
import { s3DownloadFileTool } from './s3-download-file.js';
import { s3UploadFileTool } from './s3-upload-file.js';
import { s3GetPresignedUrlsTool } from './s3-get-presigned-urls.js';
import { s3SyncFolderTool } from './s3-sync-folder.js';

/**
 * Agent に内蔵されるローカルツール一覧
 * 新しいツールを追加する場合はここに追加
 */
export const localTools = [
  executeCommandTool,
  tavilySearchTool,
  tavilyExtractTool,
  tavilyCrawlTool,
  codeInterpreterTool,
  s3ListFilesTool,
  s3DownloadFileTool,
  s3UploadFileTool,
  s3GetPresignedUrlsTool,
  s3SyncFolderTool,
];
