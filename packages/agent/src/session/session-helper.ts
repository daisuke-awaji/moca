/**
 * Session configuration helper
 */

import { SessionPersistenceHook } from './session-persistence-hook.js';
import { SessionCompactionHook } from './session-compaction-hook.js';
import { createSessionStorage } from './index.js';
import type { SessionConfig } from './types.js';
import type { CompactionConfig } from './compaction/types.js';
import { config } from '../config/index.js';

/**
 * Result of session setup
 */
export interface SessionSetupResult {
  config: SessionConfig;
  hook: SessionPersistenceHook;
  compactionHook?: SessionCompactionHook;
}

// Initialize session storage once (shared across all sessions)
const sessionStorage = createSessionStorage();

/**
 * Get compaction config from environment variables
 */
function getCompactionConfig(): CompactionConfig {
  return {
    enabled: config.COMPACTION_ENABLED,
    messageThreshold: config.COMPACTION_THRESHOLD,
    keepRecentMessages: config.KEEP_RECENT_MESSAGES,
  };
}

/**
 * Setup session configuration and hooks
 * @param actorId User ID
 * @param sessionId Session ID from header
 * @returns Session configuration and hooks, or null if no sessionId provided
 */
export function setupSession(
  actorId: string,
  sessionId: string | undefined
): SessionSetupResult | null {
  if (!sessionId) {
    return null;
  }

  const sessionConfig: SessionConfig = { actorId, sessionId };
  const hook = new SessionPersistenceHook(sessionStorage, sessionConfig);

  // Create compaction hook if enabled
  const compactionConfig = getCompactionConfig();
  let compactionHook: SessionCompactionHook | undefined;

  if (compactionConfig.enabled) {
    compactionHook = new SessionCompactionHook(
      sessionStorage,
      sessionConfig,
      compactionConfig,
      config.BEDROCK_REGION
    );
  }

  return { config: sessionConfig, hook, compactionHook };
}

/**
 * Get the shared session storage instance
 */
export function getSessionStorage() {
  return sessionStorage;
}
