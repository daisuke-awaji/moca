/**
 * Scoped Credentials Initialization Helper
 *
 * Initializes scoped credentials for the current user if configured.
 * The scoped credentials restrict S3 access to `users/{userId}/*` only,
 * preventing the Agent from accessing other users' data via execute_command.
 */

import { ScopedCredentialsService } from './scoped-credentials.js';
import type { ScopedCredentials } from './scoped-credentials.js';
import type { RequestContext } from '../context/request-context.js';
import { logger } from '../config/index.js';

/**
 * Singleton scoped credentials service instance.
 * Created once and reused across requests (caching is per-userId internally).
 */
let serviceInstance: ScopedCredentialsService | null = null;

/**
 * Check if scoped credentials are enabled.
 * Requires both SCOPED_CREDENTIALS_ROLE_ARN and USER_STORAGE_BUCKET_NAME.
 */
export function isScopedCredentialsEnabled(): boolean {
  return !!(process.env.SCOPED_CREDENTIALS_ROLE_ARN && process.env.USER_STORAGE_BUCKET_NAME);
}

/**
 * Get the singleton ScopedCredentialsService instance.
 */
function getService(): ScopedCredentialsService | null {
  if (serviceInstance) return serviceInstance;

  const roleArn = process.env.SCOPED_CREDENTIALS_ROLE_ARN;
  const bucketName = process.env.USER_STORAGE_BUCKET_NAME;

  if (!roleArn || !bucketName) {
    return null;
  }

  serviceInstance = new ScopedCredentialsService({
    roleArn,
    bucketName,
    region: process.env.AWS_REGION,
  });

  logger.info('[SCOPED_CREDS] Service initialized:', {
    roleArn: roleArn.replace(/\d{12}/, '***'),
    bucketName,
  });

  return serviceInstance;
}

/**
 * Initialize scoped credentials for the given user and attach to the request context.
 *
 * This is a non-blocking best-effort operation. If scoped credentials cannot be
 * obtained (e.g., STS error), the context will NOT have scopedCredentials set,
 * and execute_command will fall back to the Runtime's default credentials.
 *
 * @param userId - The resolved effective user ID
 * @param context - The request context to attach credentials to
 * @returns The scoped credentials, or null if not available
 */
export async function initializeScopedCredentials(
  userId: string,
  context?: RequestContext
): Promise<ScopedCredentials | null> {
  const service = getService();

  if (!service) {
    logger.debug('[SCOPED_CREDS] Not configured, skipping');
    return null;
  }

  if (userId === 'anonymous') {
    logger.debug('[SCOPED_CREDS] Anonymous user, skipping');
    return null;
  }

  try {
    const credentials = await service.getCredentials(userId);

    if (context) {
      context.scopedCredentials = credentials;
    }

    logger.info(`[SCOPED_CREDS] Credentials attached to context for user=${userId}`);
    return credentials;
  } catch (error) {
    // Log but don't fail the request — fall back to unscoped credentials
    logger.warn('[SCOPED_CREDS] Failed to obtain scoped credentials, falling back to default:', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Reset the singleton service instance (for testing).
 */
export function resetServiceInstance(): void {
  serviceInstance = null;
}
