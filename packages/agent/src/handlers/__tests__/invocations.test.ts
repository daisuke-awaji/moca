/**
 * Invocations Handler Tests
 * Tests for user ID resolution based on authentication type
 */

import { describe, it, expect } from '@jest/globals';
import {
  resolveEffectiveUserId,
  validateMachineUserScopes,
  validateTargetUserId,
  REQUIRED_MACHINE_USER_SCOPE,
} from '../invocations.js';
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
    it('should return targetUserId for machine user with valid scope', () => {
      const context = createMachineUserContext('machine-client-id', [REQUIRED_MACHINE_USER_SCOPE]);
      const result = resolveEffectiveUserId(context, 'target-user@example.com');

      expect(result).toEqual({
        userId: 'target-user@example.com',
      });
    });

    it('should return 403 error if machine user has no scopes', () => {
      const context = createMachineUserContext('machine-client-id', undefined);
      const result = resolveEffectiveUserId(context, 'target-user@example.com');

      expect(result).toEqual({
        userId: '',
        error: {
          status: 403,
          message: `Insufficient scope: '${REQUIRED_MACHINE_USER_SCOPE}' scope is required for machine user invocation`,
        },
      });
    });

    it('should return 403 error if machine user has empty scopes array', () => {
      const context = createMachineUserContext('machine-client-id', []);
      const result = resolveEffectiveUserId(context, 'target-user@example.com');

      expect(result).toEqual({
        userId: '',
        error: {
          status: 403,
          message: `Insufficient scope: '${REQUIRED_MACHINE_USER_SCOPE}' scope is required for machine user invocation`,
        },
      });
    });

    it('should return 403 error if machine user has wrong scopes', () => {
      const context = createMachineUserContext('machine-client-id', ['agent/tools', 'agent/admin']);
      const result = resolveEffectiveUserId(context, 'target-user@example.com');

      expect(result).toEqual({
        userId: '',
        error: {
          status: 403,
          message: `Insufficient scope: '${REQUIRED_MACHINE_USER_SCOPE}' scope is required, but only [agent/tools, agent/admin] provided`,
        },
      });
    });

    it('should return 400 error if machine user does not provide targetUserId', () => {
      const context = createMachineUserContext('machine-client-id', [REQUIRED_MACHINE_USER_SCOPE]);
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
      const context = createMachineUserContext('machine-client-id', [REQUIRED_MACHINE_USER_SCOPE]);
      const result = resolveEffectiveUserId(context, '');

      // Empty string is falsy, so it triggers "required" error first
      expect(result).toEqual({
        userId: '',
        error: {
          status: 400,
          message: 'targetUserId is required for machine user (Client Credentials Flow)',
        },
      });
    });

    it('should return 400 error if targetUserId is not a valid email', () => {
      const context = createMachineUserContext('machine-client-id', [REQUIRED_MACHINE_USER_SCOPE]);
      const result = resolveEffectiveUserId(context, 'invalid-user-id');

      expect(result).toEqual({
        userId: '',
        error: {
          status: 400,
          message: 'targetUserId must be a valid email format',
        },
      });
    });

    it('should return 400 error if targetUserId contains dangerous characters', () => {
      const context = createMachineUserContext('machine-client-id', [REQUIRED_MACHINE_USER_SCOPE]);
      const result = resolveEffectiveUserId(context, 'user<script>@example.com');

      expect(result).toEqual({
        userId: '',
        error: {
          status: 400,
          message: 'targetUserId contains invalid characters',
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

describe('validateMachineUserScopes', () => {
  it('should return valid for correct scope', () => {
    const result = validateMachineUserScopes([REQUIRED_MACHINE_USER_SCOPE]);
    expect(result).toEqual({ valid: true });
  });

  it('should return valid when required scope is among multiple scopes', () => {
    const result = validateMachineUserScopes([
      'agent/tools',
      REQUIRED_MACHINE_USER_SCOPE,
      'agent/admin',
    ]);
    expect(result).toEqual({ valid: true });
  });

  it('should return error for undefined scopes', () => {
    const result = validateMachineUserScopes(undefined);
    expect(result.valid).toBe(false);
    expect(result.error?.status).toBe(403);
    expect(result.error?.message).toContain(REQUIRED_MACHINE_USER_SCOPE);
  });

  it('should return error for empty scopes array', () => {
    const result = validateMachineUserScopes([]);
    expect(result.valid).toBe(false);
    expect(result.error?.status).toBe(403);
  });

  it('should return error when required scope is missing', () => {
    const result = validateMachineUserScopes(['agent/tools', 'agent/admin']);
    expect(result.valid).toBe(false);
    expect(result.error?.status).toBe(403);
    expect(result.error?.message).toContain('agent/tools');
    expect(result.error?.message).toContain('agent/admin');
  });
});

describe('validateTargetUserId', () => {
  describe('valid inputs', () => {
    it('should accept valid email format', () => {
      const result = validateTargetUserId('user@example.com');
      expect(result).toEqual({ valid: true });
    });

    it('should accept email with subdomain', () => {
      const result = validateTargetUserId('user@mail.example.com');
      expect(result).toEqual({ valid: true });
    });

    it('should accept email with plus sign', () => {
      const result = validateTargetUserId('user+tag@example.com');
      expect(result).toEqual({ valid: true });
    });

    it('should accept email with dots in local part', () => {
      const result = validateTargetUserId('first.last@example.com');
      expect(result).toEqual({ valid: true });
    });
  });

  describe('invalid inputs - format', () => {
    it('should reject empty string', () => {
      const result = validateTargetUserId('');
      expect(result.valid).toBe(false);
      expect(result.error?.status).toBe(400);
      expect(result.error?.message).toContain('empty');
    });

    it('should reject whitespace-only string', () => {
      const result = validateTargetUserId('   ');
      expect(result.valid).toBe(false);
      expect(result.error?.status).toBe(400);
      expect(result.error?.message).toContain('empty');
    });

    it('should reject non-email format', () => {
      const result = validateTargetUserId('not-an-email');
      expect(result.valid).toBe(false);
      expect(result.error?.status).toBe(400);
      expect(result.error?.message).toContain('email format');
    });

    it('should reject email without domain', () => {
      const result = validateTargetUserId('user@');
      expect(result.valid).toBe(false);
      expect(result.error?.status).toBe(400);
    });

    it('should reject email without local part', () => {
      const result = validateTargetUserId('@example.com');
      expect(result.valid).toBe(false);
      expect(result.error?.status).toBe(400);
    });
  });

  describe('invalid inputs - security', () => {
    it('should reject HTML tags', () => {
      const result = validateTargetUserId('user<script>@example.com');
      expect(result.valid).toBe(false);
      expect(result.error?.status).toBe(400);
      expect(result.error?.message).toContain('invalid characters');
    });

    it('should reject closing HTML tags', () => {
      const result = validateTargetUserId('user>@example.com');
      expect(result.valid).toBe(false);
      expect(result.error?.status).toBe(400);
    });

    it('should reject newline characters', () => {
      const result = validateTargetUserId('user@example.com\nX-Injected: header');
      expect(result.valid).toBe(false);
      expect(result.error?.status).toBe(400);
    });

    it('should reject carriage return characters', () => {
      const result = validateTargetUserId('user@example.com\rX-Injected: header');
      expect(result.valid).toBe(false);
      expect(result.error?.status).toBe(400);
    });

    it('should reject javascript: protocol', () => {
      const result = validateTargetUserId('javascript:alert(1)@example.com');
      expect(result.valid).toBe(false);
      expect(result.error?.status).toBe(400);
    });
  });
});
