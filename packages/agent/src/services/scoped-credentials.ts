/**
 * Scoped Credentials Service
 *
 * Issues per-user temporary credentials via STS AssumeRole with an inline
 * session policy that restricts S3 access to `users/{userId}/*`.
 *
 * This ensures that even when the Agent uses execute_command to run
 * `aws s3 ls` or similar CLI commands, it can only see the current user's
 * directory — not other users' data.
 *
 * Credentials are cached per userId and automatically refreshed when nearing
 * expiration (5-minute buffer).
 */

import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';
import { logger } from '../config/index.js';

/**
 * Resolved scoped credentials ready for consumption.
 */
export interface ScopedCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: Date;
}

/**
 * Environment variable map suitable for child_process.exec env option.
 */
export interface ScopedCredentialsEnvVars {
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  AWS_SESSION_TOKEN: string;
}

/**
 * Configuration for the scoped credentials service.
 */
export interface ScopedCredentialsConfig {
  /** IAM Role ARN to assume (typically the Runtime's own role). */
  roleArn: string;
  /** S3 bucket name for user storage. */
  bucketName: string;
  /** AWS region for STS client. Defaults to AWS_REGION env var. */
  region?: string;
  /** Credential duration in seconds. Defaults to 3600 (1 hour). */
  durationSeconds?: number;
  /** Refresh buffer in milliseconds. Credentials are refreshed this long before expiry. Defaults to 5 minutes. */
  refreshBufferMs?: number;
}

/**
 * Cached credential entry.
 */
interface CacheEntry {
  credentials: ScopedCredentials;
  /** Promise used for deduplicating concurrent requests for the same user. */
  pendingRefresh?: Promise<ScopedCredentials>;
}

/**
 * Buffer time before expiration to trigger credential refresh (default: 5 minutes).
 */
const DEFAULT_REFRESH_BUFFER_MS = 5 * 60 * 1000;

/**
 * Maximum RoleSessionName length per STS AssumeRole specification.
 */
const MAX_SESSION_NAME_LENGTH = 64;

/**
 * Service that issues per-user scoped AWS credentials.
 */
export class ScopedCredentialsService {
  private readonly stsClient: STSClient;
  private readonly roleArn: string;
  private readonly bucketName: string;
  private readonly durationSeconds: number;
  private readonly refreshBufferMs: number;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(config: ScopedCredentialsConfig) {
    this.roleArn = config.roleArn;
    this.bucketName = config.bucketName;
    this.durationSeconds = config.durationSeconds ?? 3600;
    this.refreshBufferMs = config.refreshBufferMs ?? DEFAULT_REFRESH_BUFFER_MS;

    this.stsClient = new STSClient({
      region: config.region ?? process.env.AWS_REGION ?? 'us-east-1',
    });
  }

  /**
   * Get scoped credentials for the given user. Returns cached credentials if
   * still valid; otherwise issues new ones via STS AssumeRole.
   */
  async getCredentials(userId: string): Promise<ScopedCredentials> {
    const cached = this.cache.get(userId);

    if (cached && this.isValid(cached.credentials)) {
      logger.debug(`[SCOPED_CREDS] Using cached credentials for user=${userId}`);
      return cached.credentials;
    }

    // Deduplicate concurrent fetches for the same user
    if (cached?.pendingRefresh) {
      logger.debug(`[SCOPED_CREDS] Waiting for pending refresh for user=${userId}`);
      return cached.pendingRefresh;
    }

    const refreshPromise = this.fetchCredentials(userId);

    // Store the pending promise so concurrent calls wait on the same fetch
    this.cache.set(userId, {
      credentials: cached?.credentials as ScopedCredentials, // may be stale
      pendingRefresh: refreshPromise,
    });

    try {
      const credentials = await refreshPromise;
      this.cache.set(userId, { credentials });
      return credentials;
    } catch (error) {
      // Remove failed entry so next attempt retries
      this.cache.delete(userId);
      throw error;
    }
  }

  /**
   * Clear cached credentials for a specific user.
   */
  clearCacheForUser(userId: string): void {
    this.cache.delete(userId);
  }

  /**
   * Clear all cached credentials.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Convert ScopedCredentials to environment variables that can be injected
   * into child_process.exec.
   */
  static toEnvVars(credentials: ScopedCredentials): ScopedCredentialsEnvVars {
    return {
      AWS_ACCESS_KEY_ID: credentials.accessKeyId,
      AWS_SECRET_ACCESS_KEY: credentials.secretAccessKey,
      AWS_SESSION_TOKEN: credentials.sessionToken,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Check if credentials are still valid (with refresh buffer).
   */
  private isValid(credentials: ScopedCredentials): boolean {
    if (!credentials?.expiration) return false;
    return credentials.expiration.getTime() - Date.now() > this.refreshBufferMs;
  }

  /**
   * Call STS AssumeRole with an inline session policy scoped to the user's
   * S3 prefix.
   */
  private async fetchCredentials(userId: string): Promise<ScopedCredentials> {
    logger.info(`[SCOPED_CREDS] Fetching scoped credentials for user=${userId}`);

    const sessionName = this.buildSessionName(userId);
    const policy = this.buildSessionPolicy(userId);

    const command = new AssumeRoleCommand({
      RoleArn: this.roleArn,
      RoleSessionName: sessionName,
      DurationSeconds: this.durationSeconds,
      Policy: JSON.stringify(policy),
    });

    const response = await this.stsClient.send(command);

    if (
      !response.Credentials?.AccessKeyId ||
      !response.Credentials?.SecretAccessKey ||
      !response.Credentials?.SessionToken
    ) {
      throw new Error('STS AssumeRole returned no credentials');
    }

    const credentials: ScopedCredentials = {
      accessKeyId: response.Credentials.AccessKeyId,
      secretAccessKey: response.Credentials.SecretAccessKey,
      sessionToken: response.Credentials.SessionToken,
      expiration: response.Credentials.Expiration ?? new Date(Date.now() + this.durationSeconds * 1000),
    };

    logger.info(`[SCOPED_CREDS] Scoped credentials issued for user=${userId}, expires=${credentials.expiration.toISOString()}`);
    return credentials;
  }

  /**
   * Build a RoleSessionName that fits within the 64-character limit.
   */
  private buildSessionName(userId: string): string {
    const prefix = 'user-';
    const maxIdLength = MAX_SESSION_NAME_LENGTH - prefix.length;
    const sanitizedId = userId.replace(/[^a-zA-Z0-9_=,.@-]/g, '_');
    return `${prefix}${sanitizedId.substring(0, maxIdLength)}`;
  }

  /**
   * Build the inline session policy JSON that restricts S3 access to
   * `users/{userId}/*`.
   *
   * Two statements are needed:
   * 1. Object-level actions on `s3:::bucket/users/{userId}/*`
   * 2. ListBucket on `s3:::bucket` with prefix condition
   */
  private buildSessionPolicy(userId: string) {
    return {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: [
            's3:GetObject',
            's3:PutObject',
            's3:DeleteObject',
            's3:HeadObject',
          ],
          Resource: [`arn:aws:s3:::${this.bucketName}/users/${userId}/*`],
        },
        {
          Effect: 'Allow',
          Action: ['s3:ListBucket'],
          Resource: [`arn:aws:s3:::${this.bucketName}`],
          Condition: {
            StringLike: {
              's3:prefix': [`users/${userId}/*`],
            },
          },
        },
      ],
    };
  }
}
