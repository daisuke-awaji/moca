/**
 * Presigned URL utilities for markdown-to-html tool
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getCurrentContext, getCurrentStoragePath } from '../../context/request-context.js';
import { logger } from '../../config/index.js';

const s3Client = new S3Client({ region: process.env.AWS_REGION });

/**
 * Media file extensions to process
 */
const MEDIA_EXTENSIONS = [
  // Images
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  // Videos
  '.mp4',
  '.webm',
  '.mov',
  '.avi',
  '.mkv',
  '.m4v',
];

/**
 * Check if a path is a media file
 */
function isMediaPath(path: string): boolean {
  const lowerPath = path.toLowerCase();
  return MEDIA_EXTENSIONS.some((ext) => lowerPath.endsWith(ext));
}

/**
 * Extract S3 storage paths from HTML content
 * Matches paths like /storage-path/images/file.png in src attributes
 */
function extractStoragePaths(html: string, storagePath: string): string[] {
  const paths: string[] = [];
  // Match src="..." attributes
  const srcPattern = /src="([^"]+)"/g;
  let match;

  while ((match = srcPattern.exec(html)) !== null) {
    const path = match[1];
    // Check if it's a storage path (starts with storagePath) and is a media file
    if (path.startsWith(storagePath) && isMediaPath(path)) {
      paths.push(path);
    }
  }

  return [...new Set(paths)]; // Remove duplicates
}

/**
 * Generate presigned URL for a storage path
 */
async function generatePresignedUrl(
  storagePath: string,
  expiresIn: number
): Promise<string | null> {
  const context = getCurrentContext();
  if (!context?.userId) {
    logger.warn('[PRESIGNED] No user context available');
    return null;
  }

  const bucketName = process.env.USER_STORAGE_BUCKET;
  if (!bucketName) {
    logger.warn('[PRESIGNED] USER_STORAGE_BUCKET not configured');
    return null;
  }

  try {
    // Convert storage path to S3 key
    // storagePath: /JAWS-UG/agent-browser/images/file.png
    // S3 key: users/{userId}/JAWS-UG/agent-browser/images/file.png
    const s3Key = `users/${context.userId}${storagePath}`;

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });
    logger.debug(`[PRESIGNED] Generated URL for ${storagePath}`);
    return url;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[PRESIGNED] Failed to generate URL for ${storagePath}: ${errorMessage}`);
    return null;
  }
}

/**
 * Replace storage paths with presigned URLs in HTML content
 */
export async function replaceWithPresignedUrls(
  html: string,
  expiresIn: number = 86400
): Promise<string> {
  const storagePath = getCurrentStoragePath();
  if (!storagePath) {
    logger.warn('[PRESIGNED] No storage path available, returning original HTML');
    return html;
  }

  const paths = extractStoragePaths(html, storagePath);
  if (paths.length === 0) {
    logger.debug('[PRESIGNED] No storage paths found in HTML');
    return html;
  }

  logger.info(`[PRESIGNED] Processing ${paths.length} media path(s)`);

  let result = html;
  for (const path of paths) {
    const presignedUrl = await generatePresignedUrl(path, expiresIn);
    if (presignedUrl) {
      // Escape special regex characters in path
      const escapedPath = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(`src="${escapedPath}"`, 'g'), `src="${presignedUrl}"`);
    }
  }

  return result;
}
