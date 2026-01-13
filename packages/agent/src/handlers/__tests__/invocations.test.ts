/**
 * Invocations Handler Tests
 * Tests for user ID resolution based on authentication type
 */

import { describe, it, expect } from '@jest/globals';
import { resolveEffectiveUserId } from '../invocations.js';
import type { RequestContext } from '../../context/request-context.js';

/**
 * Helper to create a mock regular user context
 */
function createRegularUserContext(userId: string): RequestContext {
  return {
    authorizationHeader: 'Bearer mock-token',
    userId,
    requestId: 'test-request-id',
    startTime: new Date(),
    isMachineUser: false,
  };
}

/**
 * Helper to create a mock machine user context
 */
function createMachineUserContext(clientId: string, scopes?: string[]): RequestContext {
  return {
    authorizationHeader: 'Bearer mock-token',
    requestId: 'test-request-id',
    startTime: new Date(),
    isMachineUser: true,
    clientId,
    scopes,
  };
}

describe('resolveEffectiveUserId', () => {
  describe('regular user (Authorization Code Flow)', () => {
    it('should return userId from context for regular user', () => {
      const context = createRegularUserContext('user@example.com');
      const result = resolveEffectiveUserId(context, undefined);

      expect(result).toEqual({
        userId: 'user@example.com',
      });
    });

    it('should return anonymous for regular user without userId', () => {
      const context: RequestContext = {
        authorizationHeader: undefined,
        requestId: 'test-request-id',
        startTime: new Date(),
        isMachineUser: false,
      };
      const result = resolveEffectiveUserId(context, undefined);

      expect(result).toEqual({
        userId: 'anonymous',
      });
    });

    it('should return 403 error if regular user tries to use targetUserId', () => {
      const context = createRegularUserContext('user@example.com');
      const result = resolveEffectiveUserId(context, 'another-user@example.com');

      expect(result).toEqual({
        userId: '',
        error: {
          status: 403,
          message: 'targetUserId is not allowed for regular users',
        },
      });
    });
  });

  describe('machine user (Client Credentials Flow)', () => {
    it('should return targetUserId for machine user', () => {
      const context = createMachineUserContext('machine-client-id', ['agentcore/batch.execute']);
      const result = resolveEffectiveUserId(context, 'target-user@example.com');

      expect(result).toEqual({
        userId: 'target-user@example.com',
      });
    });

    it('should return 400 error if machine user does not provide targetUserId', () => {
      const context = createMachineUserContext('machine-client-id', ['agentcore/batch.execute']);
      const result = resolveEffectiveUserId(context, undefined);

      expect(result).toEqual({
        userId: '',
        error: {
          status: 400,
          message: 'targetUserId is required for machine user (Client Credentials Flow)',
        },
      });
    });

    it('should return 400 error if machine user provides empty targetUserId', () => {
      const context = createMachineUserContext('machine-client-id', ['agentcore/batch.execute']);
      const result = resolveEffectiveUserId(context, '');

      expect(result).toEqual({
        userId: '',
        error: {
          status: 400,
          message: 'targetUserId is required for machine user (Client Credentials Flow)',
        },
      });
    });
  });

  describe('edge cases', () => {
    it('should handle undefined context', () => {
      const result = resolveEffectiveUserId(undefined, undefined);

      expect(result).toEqual({
        userId: 'anonymous',
      });
    });

    it('should return 403 for undefined context with targetUserId', () => {
      const result = resolveEffectiveUserId(undefined, 'target-user@example.com');

      expect(result).toEqual({
        userId: '',
        error: {
          status: 403,
          message: 'targetUserId is not allowed for regular users',
        },
      });
    });
  });
});
