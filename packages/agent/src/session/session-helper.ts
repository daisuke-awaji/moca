/**
 * Session configuration helper
 */

import { SessionPersistenceHook } from './session-persistence-hook.js';
import { createSessionStorage } from './index.js';
import type { SessionConfig, SessionType } from './types.js';

/**
 * Result of session setup
 */
export interface SessionSetupResult {
  config: SessionConfig;
  hook: SessionPersistenceHook;
}

// Initialize session storage once (shared across all sessions)
const sessionStorage = createSessionStorage();

/**
 * Setup session configuration and hook
 * @param actorId User ID
 * @param sessionId Session ID from header
 * @param sessionType Session type (default: 'user')
 * @returns Session configuration and hook, or null if no sessionId provided
 */
export function setupSession(
  actorId: string,
  sessionId: string | undefined,
  sessionType?: SessionType
): SessionSetupResult | null {
  if (!sessionId) {
    return null;
  }

  const config: SessionConfig = { actorId, sessionId, sessionType };
  const hook = new SessionPersistenceHook(sessionStorage, config);

  return { config, hook };
}

/**
 * Get the shared session storage instance
 */
export function getSessionStorage() {
  return sessionStorage;
}
