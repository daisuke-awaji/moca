/**
 * S3 Download File Tool - Download and read files
 */

import { tool } from '@strands-agents/sdk';
import { z } from 'zod';
import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getCurrentContext, getCurrentStoragePath } from '../context/request-context.js';
import { logger } from '../config/index.js';

const s3Client = new S3Client({ region: process.env.AWS_REGION });

// Maximum file size considering Bedrock Converse API limits
// Note: MAX_INLINE_SIZE (5MB) is a reference value. MAX_TEXT_SIZE is used for actual text retrieval limit
const MAX_TEXT_SIZE = 1 * 1024 * 1024; // 1MB (actual text file retrieval limit)

/**
 * Generate user storage path prefix
 */
function getUserStoragePrefix(userId: string): string {
  return `users/${userId}`;
}

/**
 * Normalize path (remove leading/trailing slashes)
 */
function normalizePath(path: string): string {
  return path.replace(/^\/+|\/+$/g, '');
}

/**
 * Verify if path is within allowed scope
 */
function isPathWithinAllowedScope(inputPath: string, allowedBasePath: string): boolean {
  const normalizedInput = normalizePath(inputPath);
  const normalizedBase = normalizePath(allowedBasePath);

  if (!normalizedBase || normalizedBase === '/') {
    return true;
  }

  return normalizedInput === normalizedBase || normalizedInput.startsWith(normalizedBase + '/');
}

/**
 * Determine if file is text based on Content-Type
 */
function isTextFile(contentType: string): boolean {
  const textTypes = [
    'text/',
    'application/json',
    'application/xml',
    'application/javascript',
    'application/typescript',
    'application/x-yaml',
  ];
  return textTypes.some((type) => contentType.startsWith(type));
}

/**
 * Convert file size to human-readable format
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * S3 Download File Tool
 */
export const s3DownloadFileTool = tool({
  name: 's3_download_file',
  description:
    'Download or read a file from user S3 storage. For text files, retrieves content directly. For large or binary files, generates a presigned download URL.',
  inputSchema: z.object({
    path: z.string().describe('Path of the file to download/read (required)'),
    returnContent: z
      .boolean()
      .default(true)
      .describe(
        'Whether to return text file content directly (default: true). If false, always returns a presigned URL'
      ),
    maxContentLength: z
      .number()
      .min(1024)
      .max(MAX_TEXT_SIZE)
      .default(500 * 1024)
      .describe('Maximum size in bytes for content retrieval. Default: 500KB, Max: 1MB'),
  }),
  callback: async (input) => {
    const { path, returnContent, maxContentLength } = input;

    // Get user ID and storage path from request context
    const context = getCurrentContext();
    if (!context?.userId) {
      logger.error('[S3_DOWNLOAD] Failed to get user ID');
      return 'Error: User authentication information not found. Please log in again.';
    }

    const userId = context.userId;
    const allowedStoragePath = getCurrentStoragePath();
    const bucketName = process.env.USER_STORAGE_BUCKET_NAME;

    if (!bucketName) {
      logger.error('[S3_DOWNLOAD] Bucket name not configured');
      return 'Error: Storage configuration incomplete (USER_STORAGE_BUCKET_NAME not set)';
    }

    // Path processing and validation (NFD normalization to match S3 keys)
    // macOS and S3 often store in NFD format
    const normalizedPath = normalizePath(path).normalize('NFD');

    // Verify path access permissions
    if (!isPathWithinAllowedScope(normalizedPath, allowedStoragePath)) {
      logger.warn(
        `[S3_DOWNLOAD] Access denied: user=${userId}, requestPath=${path}, allowedPath=${allowedStoragePath}`
      );
      return `Access denied: The specified path "${path}" is outside the permitted directory ("${allowedStoragePath}").`;
    }

    const key = `${getUserStoragePrefix(userId)}/${normalizedPath}`;

    logger.info(
      `[S3_DOWNLOAD] Starting file retrieval: user=${userId}, path=${path}, allowedPath=${allowedStoragePath}, returnContent=${returnContent}`
    );
    logger.info(`[S3_DOWNLOAD] S3 key: bucket=${bucketName}, key=${key}`);

    try {
      // First, retrieve file metadata
      const headCommand = new HeadObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      const metadata = await s3Client.send(headCommand);
      const fileSize = metadata.ContentLength || 0;
      const contentType = metadata.ContentType || 'application/octet-stream';

      logger.info(
        `[S3_DOWNLOAD] File info: size=${formatFileSize(fileSize)}, type=${contentType}, lastModified=${metadata.LastModified}`
      );

      // For oversized or binary files, return presigned URL
      const isText = isTextFile(contentType);
      const shouldReturnContent = returnContent && isText && fileSize <= maxContentLength;

      if (!shouldReturnContent) {
        // Generate presigned URL
        const getCommand = new GetObjectCommand({
          Bucket: bucketName,
          Key: key,
        });

        const expiresIn = 3600; // 1 hour
        const downloadUrl = await getSignedUrl(s3Client, getCommand, { expiresIn });

        logger.info(`[S3_DOWNLOAD] Presigned URL generated: expires=${expiresIn}s`);

        let reason = '';
        if (!returnContent) {
          reason = '(Presigned URL download was requested)';
        } else if (!isText) {
          reason = '(Binary file cannot return content directly)';
        } else if (fileSize > maxContentLength) {
          reason = `(File size exceeds limit: ${formatFileSize(fileSize)} > ${formatFileSize(maxContentLength)})`;
        }

        return `S3 File - Download URL Generated

File: ${path}
Size: ${formatFileSize(fileSize)}
Type: ${contentType}
Last Modified: ${metadata.LastModified?.toISOString()}

${reason}

Download URL:
${downloadUrl}

Expires: ${expiresIn / 60} minutes (${new Date(Date.now() + expiresIn * 1000).toISOString()})

You can download the file using this URL.`;
      }

      // Retrieve text file content directly
      const getCommand = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      const response = await s3Client.send(getCommand);

      if (!response.Body) {
        throw new Error('Failed to retrieve file content');
      }

      // Convert stream to text
      const bodyString = await response.Body.transformToString('utf-8');

      logger.info(`[S3_DOWNLOAD] File content retrieved: ${bodyString.length} characters`);

      // Truncate if content is too long
      const truncated = bodyString.length > maxContentLength;
      const content = truncated ? bodyString.substring(0, maxContentLength) : bodyString;

      let output = `S3 File - Content\n\n`;
      output += `File: ${path}\n`;
      output += `Size: ${formatFileSize(fileSize)}\n`;
      output += `Type: ${contentType}\n`;
      output += `Last Modified: ${metadata.LastModified?.toISOString()}\n`;

      if (truncated) {
        output += `\nNote: File is too long, showing only the first ${formatFileSize(maxContentLength)}.\n`;
        output += `To retrieve the complete content, specify returnContent=false to get a download URL.\n`;
      }

      output += `\n${'─'.repeat(60)}\n`;
      output += content;
      output += `\n${'─'.repeat(60)}\n`;

      if (truncated) {
        output += `\n(... remaining ${formatFileSize(bodyString.length - maxContentLength)} omitted)`;
      }

      return output;
    } catch (error: unknown) {
      // Get AWS SDK error details
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorName = error instanceof Error ? error.name : 'UnknownError';

      // Detailed error logging
      logger.error(`[S3_DOWNLOAD] Error: ${errorName} - ${errorMessage}`, {
        path,
        key,
        bucket: bucketName,
        userId,
      });

      if (error instanceof Error && error.stack) {
        logger.error(`Stack trace: ${error.stack}`);
      }

      // NotFound error case
      if (errorMessage.includes('NotFound') || errorMessage.includes('NoSuchKey')) {
        return `File not found
Path: ${path}
S3 Key: ${key}

The specified file does not exist.
Use the s3_list_files tool to check available files.`;
      }

      return `Error occurred while retrieving file
Path: ${path}
S3 Key: ${key}
Error Type: ${errorName}
Error: ${errorMessage}

Possible causes:
1. The specified file does not exist
2. File name encoding issue (especially Japanese filenames)
3. No access permission to the file
4. Connection problem to S3 bucket
5. AWS credentials issue

Debug info: Check logs for details`;
    }
  },
});
