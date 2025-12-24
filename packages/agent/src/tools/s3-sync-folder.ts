/**
 * S3 Sync Folder Tool - Download entire folder from S3 to local
 */

import { tool } from '@strands-agents/sdk';
import { z } from 'zod';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { getCurrentContext, getCurrentStoragePath } from '../context/request-context.js';
import { logger } from '../config/index.js';
import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from 'stream/promises';

const s3Client = new S3Client({ region: process.env.AWS_REGION });

// Local path constraints
const ALLOWED_LOCAL_BASE = '/tmp/ws';

// Default concurrency settings
const DEFAULT_MAX_CONCURRENCY = 5;
const DEFAULT_MAX_FILES = 100;
const MAX_FILES_LIMIT = 1000;

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
 * Verify if local path is within allowed directory
 */
function isLocalPathAllowed(localPath: string): boolean {
  const resolvedPath = path.resolve(localPath);
  const allowedBase = path.resolve(ALLOWED_LOCAL_BASE);
  return resolvedPath.startsWith(allowedBase);
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
 * Create directory recursively if it doesn't exist
 */
function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Match file name against glob pattern
 */
function matchPattern(filename: string, pattern: string): boolean {
  if (!pattern) return true;

  // Simple glob pattern matching (* and ?)
  const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.');

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(filename);
}

/**
 * Download a single file from S3
 */
async function downloadFile(
  bucketName: string,
  s3Key: string,
  localPath: string
): Promise<{ success: boolean; size: number; error?: string }> {
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
    });

    const response = await s3Client.send(command);

    if (!response.Body) {
      throw new Error('Empty response body');
    }

    // Ensure directory exists
    const dir = path.dirname(localPath);
    ensureDirectoryExists(dir);

    // Stream file to disk
    const writeStream = fs.createWriteStream(localPath);
    await pipeline(response.Body as NodeJS.ReadableStream, writeStream);

    const stats = fs.statSync(localPath);
    return { success: true, size: stats.size };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[S3_SYNC] Failed to download file: ${s3Key} - ${errorMessage}`);
    return { success: false, size: 0, error: errorMessage };
  }
}

/**
 * S3 Sync Folder Tool
 */
export const s3SyncFolderTool = tool({
  name: 's3_sync_folder',
  description:
    'Download an entire folder from S3 storage to local directory. Similar to "aws s3 sync" command. Downloads all files in the specified S3 folder to the local agent environment.',
  inputSchema: z.object({
    s3Path: z.string().describe('S3 folder path to sync (e.g., "/project/data")'),
    localPath: z
      .string()
      .describe(
        `Local destination path (must be under ${ALLOWED_LOCAL_BASE}, e.g., "${ALLOWED_LOCAL_BASE}/data")`
      ),
    recursive: z
      .boolean()
      .default(true)
      .describe('Whether to include subdirectories recursively (default: true)'),
    overwrite: z
      .boolean()
      .default(false)
      .describe('Whether to overwrite existing files (default: false)'),
    maxConcurrency: z
      .number()
      .min(1)
      .max(10)
      .default(DEFAULT_MAX_CONCURRENCY)
      .describe(
        `Maximum number of concurrent downloads (1-10, default: ${DEFAULT_MAX_CONCURRENCY})`
      ),
    maxFiles: z
      .number()
      .min(1)
      .max(MAX_FILES_LIMIT)
      .default(DEFAULT_MAX_FILES)
      .describe(
        `Maximum number of files to download (1-${MAX_FILES_LIMIT}, default: ${DEFAULT_MAX_FILES})`
      ),
    filePattern: z
      .string()
      .optional()
      .describe('File name pattern to filter (glob pattern, e.g., "*.txt", "data_*.json")'),
  }),
  callback: async (input) => {
    const { s3Path, localPath, recursive, overwrite, maxConcurrency, maxFiles, filePattern } =
      input;

    // Get user ID and storage path from request context
    const context = getCurrentContext();
    if (!context?.userId) {
      logger.error('[S3_SYNC] Failed to get user ID');
      return 'Error: User authentication information not found. Please log in again.';
    }

    const userId = context.userId;
    const allowedStoragePath = getCurrentStoragePath();
    const bucketName = process.env.USER_STORAGE_BUCKET_NAME;

    if (!bucketName) {
      logger.error('[S3_SYNC] Bucket name not configured');
      return 'Error: Storage configuration incomplete (USER_STORAGE_BUCKET_NAME not set)';
    }

    // Validate local path
    if (!isLocalPathAllowed(localPath)) {
      logger.warn(`[S3_SYNC] Invalid local path: ${localPath}`);
      return `Error: Local path must be under ${ALLOWED_LOCAL_BASE}\nSpecified path: ${localPath}`;
    }

    // Normalize and validate S3 path
    const normalizedS3Path = normalizePath(s3Path).normalize('NFD');

    if (!isPathWithinAllowedScope(normalizedS3Path, allowedStoragePath)) {
      logger.warn(
        `[S3_SYNC] Access denied: user=${userId}, requestPath=${s3Path}, allowedPath=${allowedStoragePath}`
      );
      return `Access denied: The specified path "${s3Path}" is outside the permitted directory ("${allowedStoragePath}").`;
    }

    const s3Prefix = normalizedS3Path
      ? `${getUserStoragePrefix(userId)}/${normalizedS3Path}/`
      : `${getUserStoragePrefix(userId)}/`;

    logger.info(
      `[S3_SYNC] Starting folder sync: user=${userId}, s3Path=${s3Path}, localPath=${localPath}, recursive=${recursive}, maxFiles=${maxFiles}`
    );

    try {
      // Step 1: List all files in S3
      const filesToDownload: Array<{ key: string; size: number; relativePath: string }> = [];
      let continuationToken: string | undefined;
      let totalScanned = 0;

      logger.info(`[S3_SYNC] Listing files from S3: prefix=${s3Prefix}`);

      do {
        const listCommand = new ListObjectsV2Command({
          Bucket: bucketName,
          Prefix: s3Prefix,
          MaxKeys: 1000,
          ContinuationToken: continuationToken,
        });

        const listResponse = await s3Client.send(listCommand);

        if (listResponse.Contents) {
          for (const item of listResponse.Contents) {
            if (!item.Key || item.Key === s3Prefix || item.Key.endsWith('/')) {
              continue; // Skip folders and the prefix itself
            }

            totalScanned++;

            const relativePath = item.Key.replace(s3Prefix, '');
            const fileName = path.basename(relativePath);

            // Apply file pattern filter
            if (filePattern && !matchPattern(fileName, filePattern)) {
              continue;
            }

            // Check recursive flag
            if (!recursive && relativePath.includes('/')) {
              continue;
            }

            filesToDownload.push({
              key: item.Key,
              size: item.Size || 0,
              relativePath,
            });

            if (filesToDownload.length >= maxFiles) {
              break;
            }
          }
        }

        continuationToken = listResponse.NextContinuationToken;

        if (filesToDownload.length >= maxFiles) {
          break;
        }
      } while (continuationToken);

      if (filesToDownload.length === 0) {
        return `No files found to sync\nS3 Path: ${s3Path}\nPattern: ${filePattern || 'all files'}\nTotal scanned: ${totalScanned} objects`;
      }

      logger.info(`[S3_SYNC] Found ${filesToDownload.length} files to download`);

      // Step 2: Create base directory
      ensureDirectoryExists(localPath);

      // Step 3: Download files with concurrency control
      const results: Array<{
        file: string;
        success: boolean;
        size: number;
        error?: string;
      }> = [];

      let downloaded = 0;
      let skipped = 0;
      let failed = 0;
      let totalBytes = 0;

      // Process files in batches for concurrency control
      for (let i = 0; i < filesToDownload.length; i += maxConcurrency) {
        const batch = filesToDownload.slice(i, i + maxConcurrency);
        const batchPromises = batch.map(async (file) => {
          const targetPath = path.join(localPath, file.relativePath);

          // Check if file already exists
          if (!overwrite && fs.existsSync(targetPath)) {
            logger.debug(`[S3_SYNC] Skipping existing file: ${file.relativePath}`);
            return {
              file: file.relativePath,
              success: true,
              size: file.size,
              skipped: true,
            };
          }

          // Download file
          const result = await downloadFile(bucketName, file.key, targetPath);
          return {
            file: file.relativePath,
            success: result.success,
            size: result.size,
            error: result.error,
          };
        });

        const batchResults = await Promise.all(batchPromises);

        for (const result of batchResults) {
          results.push(result);
          if ('skipped' in result && result.skipped) {
            skipped++;
          } else if (result.success) {
            downloaded++;
            totalBytes += result.size;
          } else {
            failed++;
          }
        }

        // Progress logging
        const progress = ((i + batch.length) / filesToDownload.length) * 100;
        logger.info(
          `[S3_SYNC] Progress: ${Math.min(progress, 100).toFixed(1)}% (${downloaded} downloaded, ${skipped} skipped, ${failed} failed)`
        );
      }

      // Step 4: Generate summary report
      let output = `S3 Folder Sync - Complete\n\n`;
      output += `S3 Path: ${s3Path}\n`;
      output += `Local Path: ${localPath}\n`;
      output += `Mode: ${recursive ? 'Recursive' : 'Current directory only'}\n`;
      if (filePattern) {
        output += `Pattern: ${filePattern}\n`;
      }
      output += `\n`;
      output += `Summary:\n`;
      output += `  Total scanned: ${totalScanned} objects\n`;
      output += `  Files to sync: ${filesToDownload.length}\n`;
      output += `  Downloaded: ${downloaded} files (${formatFileSize(totalBytes)})\n`;
      output += `  Skipped: ${skipped} files (already exist)\n`;
      output += `  Failed: ${failed} files\n`;

      if (failed > 0) {
        output += `\nFailed Files:\n`;
        results
          .filter((r) => !r.success)
          .forEach((r) => {
            output += `  - ${r.file}\n`;
            output += `    Error: ${r.error}\n`;
          });
      }

      if (filesToDownload.length >= maxFiles) {
        output += `\nNote: Download limit reached (${maxFiles} files). Increase maxFiles parameter to sync more files.`;
      }

      logger.info(
        `[S3_SYNC] Sync complete: downloaded=${downloaded}, skipped=${skipped}, failed=${failed}`
      );

      return output;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorName = error instanceof Error ? error.name : 'UnknownError';

      logger.error(`[S3_SYNC] Error: ${errorName} - ${errorMessage}`, {
        s3Path,
        localPath,
        userId,
      });

      if (error instanceof Error && error.stack) {
        logger.error(`Stack trace: ${error.stack}`);
      }

      return `Error occurred during folder sync
S3 Path: ${s3Path}
Local Path: ${localPath}
Error Type: ${errorName}
Error: ${errorMessage}

Possible causes:
1. The specified S3 path does not exist
2. Insufficient permissions to access S3 bucket
3. Network connection problem
4. AWS credentials issue
5. Local disk space insufficient`;
    }
  },
});
