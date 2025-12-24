/**
 * S3 Get Presigned URLs Tool - Batch retrieval of presigned URLs
 */

import { tool } from '@strands-agents/sdk';
import { z } from 'zod';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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
 * S3 Get Presigned URLs Tool
 */
export const s3GetPresignedUrlsTool = tool({
  name: 's3_get_presigned_urls',
  description:
    'Generate presigned URLs in batch for files in user S3 storage. Can retrieve URLs for download or upload operations. Multiple files can be processed at once.',
  inputSchema: z.object({
    paths: z
      .union([z.string(), z.array(z.string())])
      .describe('File path(s) (single string or array of strings)'),
    operation: z
      .enum(['download', 'upload'])
      .default('download')
      .describe('Operation type: "download" (for downloading) or "upload" (for uploading)'),
    expiresIn: z
      .number()
      .min(60)
      .max(604800)
      .default(3600)
      .describe(
        'Presigned URL expiration time in seconds. Default: 3600 (1 hour), Max: 604800 (7 days)'
      ),
    contentType: z.string().optional().describe('Content-Type for upload operations (optional)'),
  }),
  callback: async (input) => {
    const { paths, operation, expiresIn, contentType } = input;

    // Get user ID and storage path from request context
    const context = getCurrentContext();
    if (!context?.userId) {
      logger.error('[S3_PRESIGNED] Failed to get user ID');
      return 'Error: User authentication information not found. Please log in again.';
    }

    const userId = context.userId;
    const allowedStoragePath = getCurrentStoragePath();
    const bucketName = process.env.USER_STORAGE_BUCKET_NAME;

    if (!bucketName) {
      logger.error('[S3_PRESIGNED] Bucket name not configured');
      return 'Error: Storage configuration incomplete (USER_STORAGE_BUCKET_NAME not set)';
    }

    // Normalize paths to array
    const pathsArray = Array.isArray(paths) ? paths : [paths];

    if (pathsArray.length === 0) {
      return 'Error: Please specify at least one file path.';
    }

    logger.info(
      `[S3_PRESIGNED] Starting presigned URL generation: user=${userId}, allowedPath=${allowedStoragePath}, operation=${operation}, count=${pathsArray.length}, expiresIn=${expiresIn}s`
    );

    try {
      const results: Array<{
        path: string;
        url: string;
        expiresAt: string;
        operation: string;
      }> = [];

      const errors: Array<{
        path: string;
        error: string;
      }> = [];

      for (const path of pathsArray) {
        try {
          // Path processing (NFD normalization to match S3 keys)
          // macOS and S3 often store in NFD format
          const normalizedPath = normalizePath(path).normalize('NFD');

          // Verify path access permissions
          if (!isPathWithinAllowedScope(normalizedPath, allowedStoragePath)) {
            logger.warn(
              `[S3_PRESIGNED] Access denied: user=${userId}, requestPath=${path}, allowedPath=${allowedStoragePath}`
            );
            errors.push({
              path,
              error: `Access denied: Path "${path}" is outside the permitted directory ("${allowedStoragePath}")`,
            });
            continue;
          }

          const key = `${getUserStoragePrefix(userId)}/${normalizedPath}`;

          let url: string;

          if (operation === 'download') {
            // Presigned URL for download
            const command = new GetObjectCommand({
              Bucket: bucketName,
              Key: key,
            });

            url = await getSignedUrl(s3Client, command, { expiresIn });
          } else {
            // Presigned URL for upload
            const command = new PutObjectCommand({
              Bucket: bucketName,
              Key: key,
              ContentType: contentType || 'application/octet-stream',
            });

            url = await getSignedUrl(s3Client, command, { expiresIn });
          }

          const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

          results.push({
            path,
            url,
            expiresAt,
            operation,
          });

          logger.info(
            `[S3_PRESIGNED] Presigned URL generated successfully: ${path} (${operation})`
          );
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.error(`[S3_PRESIGNED] Presigned URL generation error: ${path} - ${errorMessage}`);

          errors.push({
            path,
            error: errorMessage,
          });
        }
      }

      // Format results
      let output = `S3 Presigned URLs Generation Result\n\n`;
      output += `Operation: ${operation === 'download' ? 'Download' : 'Upload'}\n`;
      output += `Expiration: ${expiresIn} seconds (${Math.floor(expiresIn / 60)} minutes)\n`;
      output += `Success: ${results.length} / Failed: ${errors.length}\n\n`;

      if (results.length > 0) {
        output += `Successful files:\n\n`;
        results.forEach((result, index) => {
          output += `${index + 1}. ${result.path}\n`;
          output += `   URL: ${result.url}\n`;
          output += `   Expires: ${new Date(result.expiresAt).toISOString()}\n\n`;
        });
      }

      if (errors.length > 0) {
        output += `\nFailed files:\n\n`;
        errors.forEach((error, index) => {
          output += `${index + 1}. ${error.path}\n`;
          output += `   Error: ${error.error}\n\n`;
        });
      }

      logger.info(
        `[S3_PRESIGNED] Presigned URL generation complete: success ${results.length}, failed ${errors.length}`
      );

      return output.trim();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[S3_PRESIGNED] Presigned URL generation error: ${errorMessage}`);

      return `Error occurred during presigned URL generation
Error: ${errorMessage}

Possible causes:
1. No access permission to S3 bucket
2. Network connection problem
3. AWS credentials issue
4. Invalid path specified`;
    }
  },
});
