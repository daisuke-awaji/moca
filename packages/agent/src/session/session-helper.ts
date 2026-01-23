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

/**
 * Options for session setup
 */
export interface SessionSetupOptions {
  actorId: string;
  sessionId: string | undefined;
  sessionType?: SessionType;
  agentId?: string;
  storagePath?: string;
}

// Initialize session storage once (shared across all sessions)
const sessionStorage = createSessionStorage();

/**
 * Setup session configuration and hook
 * @param options Session setup options
 * @returns Session configuration and hook, or null if no sessionId provided
 */
export function setupSession(options: SessionSetupOptions): SessionSetupResult | null;

/**
 * Setup session configuration and hook (legacy signature for backward compatibility)
 * @param actorId User ID
 * @param sessionId Session ID from header
 * @param sessionType Session type (default: 'user')
 * @returns Session configuration and hook, or null if no sessionId provided
 * @deprecated Use the options object signature instead
 */
export function setupSession(
  actorId: string,
  sessionId: string | undefined,
  sessionType?: SessionType
): SessionSetupResult | null;

export function setupSession(
  optionsOrActorId: SessionSetupOptions | string,
  sessionId?: string | undefined,
  sessionType?: SessionType
): SessionSetupResult | null {
  // Handle both signatures
  let options: SessionSetupOptions;

  if (typeof optionsOrActorId === 'string') {
    // Legacy signature
    options = {
      actorId: optionsOrActorId,
      sessionId,
      sessionType,
    };
  } else {
    // New signature with options object
    options = optionsOrActorId;
  }

  if (!options.sessionId) {
    return null;
  }

  const config: SessionConfig = {
    actorId: options.actorId,
    sessionId: options.sessionId,
    sessionType: options.sessionType,
  };
  const hook = new SessionPersistenceHook(
    sessionStorage,
    config,
    options.agentId,
    options.storagePath
  );

  return { config, hook };
}

/**
 * Get the shared session storage instance
 */
export function getSessionStorage() {
  return sessionStorage;
}
