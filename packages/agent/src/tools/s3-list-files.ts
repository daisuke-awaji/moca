/**
 * S3 List Files Tool - Retrieve user storage file list
 */

import { tool } from '@strands-agents/sdk';
import { z } from 'zod';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getCurrentContext, getCurrentStoragePath } from '../context/request-context.js';
import { logger } from '../config/index.js';

const s3Client = new S3Client({ region: process.env.AWS_REGION });

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
 * Prevents path traversal attacks (../)
 */
function isPathWithinAllowedScope(inputPath: string, allowedBasePath: string): boolean {
  // Normalize paths
  const normalizedInput = normalizePath(inputPath);
  const normalizedBase = normalizePath(allowedBasePath);

  // Allow all if base path is root (empty string)
  if (!normalizedBase || normalizedBase === '/') {
    return true;
  }

  // Check if input path starts with base path or is the same
  return normalizedInput === normalizedBase || normalizedInput.startsWith(normalizedBase + '/');
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
 * Convert date to relative time expression
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} days ago`;
  if (hours > 0) return `${hours} hours ago`;
  if (minutes > 0) return `${minutes} minutes ago`;
  return `${seconds} seconds ago`;
}

/**
 * S3 List Files Tool
 */
export const s3ListFilesTool = tool({
  name: 's3_list_files',
  description:
    'Retrieve a list of files and directories in user S3 storage. Can explore contents under the specified path.',
  inputSchema: z.object({
    path: z.string().default('/').describe('Directory path to list (default: root "/")'),
    recursive: z
      .boolean()
      .default(false)
      .describe('Whether to retrieve subdirectories recursively (default: false)'),
    maxResults: z
      .number()
      .min(1)
      .max(1000)
      .default(100)
      .describe('Maximum number of results to retrieve (1-1000, default: 100)'),
  }),
  callback: async (input) => {
    const { path, recursive, maxResults } = input;

    // Get user ID and storage path from request context
    const context = getCurrentContext();
    if (!context?.userId) {
      logger.error('[S3_LIST] Failed to get user ID');
      return 'Error: User authentication information not found. Please log in again.';
    }

    const userId = context.userId;
    const allowedStoragePath = getCurrentStoragePath();
    const bucketName = process.env.USER_STORAGE_BUCKET_NAME;

    if (!bucketName) {
      logger.error('[S3_LIST] Bucket name not configured');
      return 'Error: Storage configuration incomplete (USER_STORAGE_BUCKET_NAME not set)';
    }

    // Path processing: use allowedStoragePath if empty or root
    let normalizedPath = normalizePath(path);
    const normalizedAllowedPath = normalizePath(allowedStoragePath);

    // Redirect to allowed path if input path is empty or root
    if (!normalizedPath || normalizedPath === '/' || normalizedPath === '') {
      normalizedPath = normalizedAllowedPath;
    }

    // Verify path access permissions
    if (!isPathWithinAllowedScope(normalizedPath, allowedStoragePath)) {
      logger.warn(
        `[S3_LIST] Access denied: user=${userId}, requestPath=${path}, allowedPath=${allowedStoragePath}`
      );
      return `Access denied: The specified path "${path}" is outside the permitted directory ("${allowedStoragePath}").\n\nPlease specify a path under the allowed directory.`;
    }

    // Build prefix (considering allowed storage path)
    const basePrefix = normalizedAllowedPath
      ? `${getUserStoragePrefix(userId)}/${normalizedAllowedPath}`
      : getUserStoragePrefix(userId);

    const prefix =
      normalizedPath && normalizedPath !== normalizedAllowedPath
        ? `${basePrefix}/${normalizedPath.replace(normalizedAllowedPath + '/', '')}/`
        : `${basePrefix}${basePrefix.endsWith('/') ? '' : '/'}`;

    logger.info(
      `[S3_LIST] File list retrieval: user=${userId}, path=${path}, allowedPath=${allowedStoragePath}, recursive=${recursive}`
    );

    try {
      const items: Array<{
        name: string;
        path: string;
        type: 'file' | 'directory';
        size?: number;
        lastModified?: Date;
      }> = [];

      if (recursive) {
        // Recursive retrieval
        let continuationToken: string | undefined;
        let totalFetched = 0;

        do {
          const command = new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: prefix,
            MaxKeys: Math.min(1000, maxResults - totalFetched),
            ContinuationToken: continuationToken,
          });

          const response = await s3Client.send(command);

          if (response.Contents) {
            for (const content of response.Contents) {
              if (content.Key && content.Key !== prefix) {
                const relativePath = content.Key.replace(prefix, '');
                items.push({
                  name: relativePath.split('/').pop() || relativePath,
                  path: `/${normalizedPath}/${relativePath}`.replace(/\/+/g, '/'),
                  type: content.Key.endsWith('/') ? 'directory' : 'file',
                  size: content.Size,
                  lastModified: content.LastModified,
                });
                totalFetched++;

                if (totalFetched >= maxResults) break;
              }
            }
          }

          continuationToken = response.NextContinuationToken;

          if (totalFetched >= maxResults) break;
        } while (continuationToken);
      } else {
        // Non-recursive retrieval (current directory only)
        const command = new ListObjectsV2Command({
          Bucket: bucketName,
          Prefix: prefix,
          Delimiter: '/',
          MaxKeys: maxResults,
        });

        const response = await s3Client.send(command);

        // Add directories
        if (response.CommonPrefixes) {
          for (const commonPrefix of response.CommonPrefixes) {
            if (commonPrefix.Prefix) {
              const name = commonPrefix.Prefix.replace(prefix, '').replace(/\/$/, '');
              items.push({
                name,
                path: `/${normalizedPath}/${name}`.replace(/\/+/g, '/'),
                type: 'directory',
              });
            }
          }
        }

        // Add files
        if (response.Contents) {
          for (const content of response.Contents) {
            if (content.Key && content.Key !== prefix) {
              const name = content.Key.replace(prefix, '');
              items.push({
                name,
                path: `/${normalizedPath}/${name}`.replace(/\/+/g, '/'),
                type: 'file',
                size: content.Size,
                lastModified: content.LastModified,
              });
            }
          }
        }
      }

      // Format results
      if (items.length === 0) {
        return `Directory is empty\nPath: ${path}\n\nNo files or directories found.`;
      }

      let output = `S3 Storage - File List\n`;
      output += `Path: ${path}\n`;
      output += `Mode: ${recursive ? 'Recursive' : 'Current directory only'}\n`;
      output += `Total: ${items.length} items\n\n`;

      // Separate and sort directories and files
      const directories = items.filter((item) => item.type === 'directory');
      const files = items.filter((item) => item.type === 'file');

      // Directory list
      if (directories.length > 0) {
        output += `Directories (${directories.length}):\n`;
        directories.forEach((dir) => {
          output += `  - ${dir.name}/\n`;
          output += `    Path: ${dir.path}\n`;
        });
        output += `\n`;
      }

      // File list
      if (files.length > 0) {
        output += `Files (${files.length}):\n`;
        files.forEach((file) => {
          output += `  - ${file.name}\n`;
          output += `    Path: ${file.path}\n`;
          if (file.size !== undefined) {
            output += `    Size: ${formatFileSize(file.size)}\n`;
          }
          if (file.lastModified) {
            output += `    Modified: ${formatRelativeTime(file.lastModified)} (${file.lastModified.toISOString()})\n`;
          }
        });
      }

      logger.info(
        `[S3_LIST] File list retrieval complete: ${items.length} items (directories: ${directories.length}, files: ${files.length})`
      );

      return output.trim();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[S3_LIST] File list retrieval error: ${errorMessage}`);

      return `Error occurred while retrieving file list
Path: ${path}
Error: ${errorMessage}

Possible causes:
1. The specified path does not exist
2. No access permission to S3 bucket
3. Network connection problem
4. AWS credentials issue`;
    }
  },
});
