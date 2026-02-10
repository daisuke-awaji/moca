import { PathValidationError } from '../errors.js';

/**
 * Validate a storage path for security.
 * Prevents path traversal attacks and ensures only safe characters are used.
 *
 * @param storagePath - Path string to validate
 * @throws {PathValidationError} if the path is invalid
 */
export function validateStoragePath(storagePath: string): void {
  if (storagePath.includes('..')) {
    throw new PathValidationError(
      "Invalid storage path: path traversal sequences ('..') are not allowed"
    );
  }

  if (storagePath.includes('\0')) {
    throw new PathValidationError('Invalid storage path: null bytes are not allowed');
  }

  if (!/^[a-zA-Z0-9\-_/.]*$/.test(storagePath)) {
    throw new PathValidationError(
      'Invalid storage path: only alphanumeric characters, hyphens, underscores, dots, and forward slashes are allowed'
    );
  }

  if (storagePath.startsWith('//')) {
    throw new PathValidationError('Invalid storage path: protocol-relative paths are not allowed');
  }

  const depth = storagePath.split('/').filter((p) => p.length > 0).length;
  if (depth > 50) {
    throw new PathValidationError('Invalid storage path: path depth exceeds maximum allowed (50)');
  }
}
