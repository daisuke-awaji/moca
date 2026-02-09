/**
 * Base API Client
 * Provides common HTTP functionality with authentication, retry, and logging
 */

import { getValidAccessToken } from '../../lib/cognito';
import { handleGlobalError } from '../../utils/errorHandler';
import { ApiError, AuthenticationError } from '../errors';

// Re-export error classes for backward compatibility
export { ApiError, AuthenticationError };

/**
 * Check if API debugging is enabled
 */
function isDebugEnabled(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_API_DEBUG === 'true';
}

/**
 * Base API Client class
 * Handles authenticated HTTP requests with automatic 401 retry and debug logging
 */
export class BaseApiClient {
  protected readonly clientName: string;

  constructor(clientName: string) {
    this.clientName = clientName;
  }

  /**
   * Create authorization headers with a fresh access token
   */
  protected async createAuthHeaders(): Promise<Record<string, string>> {
    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      throw new AuthenticationError();
    }

    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    };
  }

  /**
   * Authenticated fetch with automatic 401 retry
   * @param url - Full URL to fetch
   * @param options - Fetch options
   * @param isRetry - Whether this is a retry attempt (internal use)
   * @returns Raw Response object
   */
  protected async fetchWithAuth(
    url: string,
    options: RequestInit = {},
    isRetry = false
  ): Promise<Response> {
    const method = options.method || 'GET';

    try {
      this.logStart(method, url);

      const headers = await this.createAuthHeaders();

      const response = await fetch(url, {
        ...options,
        headers: { ...headers, ...(options.headers as Record<string, string>) },
      });

      // On 401, attempt token refresh and retry once
      if (response.status === 401 && !isRetry) {
        console.warn(
          '⚠️ [%s] 401 on %s %s, attempting token refresh and retry...',
          this.clientName,
          method,
          url
        );
        const error = new ApiError('Unauthorized', 401, 'Unauthorized');
        await handleGlobalError(error); // This triggers token refresh
        return this.fetchWithAuth(url, options, true);
      }

      // If still 401 on retry, force logout
      if (response.status === 401 && isRetry) {
        const error = new ApiError('Unauthorized', 401, 'Unauthorized');
        await handleGlobalError(error, true); // skipRefreshAttempt = true
        throw error;
      }

      this.logSuccess(method, url, response.status);
      return response;
    } catch (error) {
      this.logError(method, url, error);

      // Avoid double-handling of 401 errors already processed above
      if (!(error instanceof ApiError && error.status === 401)) {
        await handleGlobalError(error, isRetry);
      }

      throw error;
    }
  }

  /**
   * Parse error response into ApiError
   */
  protected async handleErrorResponse(response: Response): Promise<never> {
    const errorData = await response.json().catch(() => ({}));

    throw new ApiError(
      errorData.message || errorData.error || 'Unknown error',
      response.status,
      response.statusText,
      errorData
    );
  }

  // --- Debug Logging ---

  private logStart(method: string, url: string): void {
    if (isDebugEnabled()) {
      console.log('🚀 [%s] %s %s', this.clientName, method, url);
    }
  }

  private logSuccess(method: string, url: string, status: number): void {
    if (isDebugEnabled()) {
      console.log('✅ [%s] %s %s -> %d', this.clientName, method, url, status);
    }
  }

  private logError(method: string, url: string, error: unknown): void {
    if (isDebugEnabled()) {
      console.error('💥 [%s] %s %s failed:', this.clientName, method, url, error);
    }
  }
}

/**
 * Normalize base URL by removing trailing slashes
 */
export function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, '');
}
