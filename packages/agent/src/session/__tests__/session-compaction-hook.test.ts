/**
 * Unit tests for SessionCompactionHook
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Message, TextBlock, HookRegistry } from '@strands-agents/sdk';
import type { SessionConfig, SessionStorage } from '../types.js';
import type { CompactionConfig } from '../compaction/types.js';

// Mock the summarizer module
jest.unstable_mockModule('../compaction/summarizer.js', () => ({
  generateSummary: jest.fn<() => Promise<string>>().mockResolvedValue('This is a test summary of the conversation.'),
}));

// Mock logger
jest.unstable_mockModule('../../config/index.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Import after mocks
const { SessionCompactionHook } = await import('../session-compaction-hook.js');

describe('SessionCompactionHook', () => {
  let mockStorage: SessionStorage;
  let sessionConfig: SessionConfig;
  let compactionConfig: CompactionConfig;
  const region = 'us-east-1';

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock storage with proper typing
    mockStorage = {
      loadMessages: jest.fn() as jest.MockedFunction<SessionStorage['loadMessages']>,
      saveMessages: jest.fn() as jest.MockedFunction<SessionStorage['saveMessages']>,
      clearSession: jest.fn() as jest.MockedFunction<SessionStorage['clearSession']>,
      appendMessage: jest.fn() as jest.MockedFunction<SessionStorage['appendMessage']>,
    };

    sessionConfig = {
      actorId: 'test-user',
      sessionId: 'test-session',
    };

    compactionConfig = {
      enabled: true,
      messageThreshold: 10,
      keepRecentMessages: 3,
    };
  });

  describe('registerCallbacks', () => {
    it('should register BeforeInvocationEvent callback', () => {
      const hook = new SessionCompactionHook(mockStorage, sessionConfig, compactionConfig, region);
      const mockRegistry = {
        addCallback: jest.fn(),
      } as unknown as HookRegistry;

      hook.registerCallbacks(mockRegistry);

      expect(mockRegistry.addCallback).toHaveBeenCalledTimes(1);
      expect(mockRegistry.addCallback).toHaveBeenCalledWith(
        expect.anything(), // BeforeInvocationEvent
        expect.any(Function)
      );
    });
  });

  describe('compaction behavior', () => {
    const createMessages = (count: number): Message[] => {
      const messages: Message[] = [];
      for (let i = 0; i < count; i++) {
        const role = i % 2 === 0 ? 'user' : 'assistant';
        messages.push(
          new Message({
            role,
            content: [new TextBlock(`Message ${i}`)],
          })
        );
      }
      return messages;
    };

    it('should not compact when disabled', async () => {
      const disabledConfig: CompactionConfig = {
        ...compactionConfig,
        enabled: false,
      };
      const hook = new SessionCompactionHook(mockStorage, sessionConfig, disabledConfig, region);

      // Trigger the hook manually (simulating BeforeInvocationEvent)
      const mockRegistry = {
        addCallback: jest.fn(),
      } as unknown as HookRegistry;
      hook.registerCallbacks(mockRegistry);

      // Get the registered callback
      const addCallbackMock = mockRegistry.addCallback as jest.MockedFunction<typeof mockRegistry.addCallback>;
      const callback = addCallbackMock.mock.calls[0][1] as (event: unknown) => Promise<void>;
      await callback({});

      expect(mockStorage.loadMessages).not.toHaveBeenCalled();
    });

    it('should not compact when message count is below threshold', async () => {
      const messages = createMessages(5); // Below threshold of 10
      jest.mocked(mockStorage.loadMessages).mockResolvedValue(messages);

      const hook = new SessionCompactionHook(mockStorage, sessionConfig, compactionConfig, region);
      const mockRegistry = {
        addCallback: jest.fn(),
      } as unknown as HookRegistry;
      hook.registerCallbacks(mockRegistry);

      const addCallbackMock = mockRegistry.addCallback as jest.MockedFunction<typeof mockRegistry.addCallback>;
      const callback = addCallbackMock.mock.calls[0][1] as (event: unknown) => Promise<void>;
      await callback({});

      expect(mockStorage.loadMessages).toHaveBeenCalledWith(sessionConfig);
      expect(mockStorage.clearSession).not.toHaveBeenCalled();
      expect(mockStorage.saveMessages).not.toHaveBeenCalled();
    });

    it('should compact when message count exceeds threshold', async () => {
      const messages = createMessages(15); // Above threshold of 10
      jest.mocked(mockStorage.loadMessages).mockResolvedValue(messages);
      jest.mocked(mockStorage.clearSession).mockResolvedValue(undefined);
      jest.mocked(mockStorage.saveMessages).mockResolvedValue(undefined);

      const hook = new SessionCompactionHook(mockStorage, sessionConfig, compactionConfig, region);
      const mockRegistry = {
        addCallback: jest.fn(),
      } as unknown as HookRegistry;
      hook.registerCallbacks(mockRegistry);

      const addCallbackMock = mockRegistry.addCallback as jest.MockedFunction<typeof mockRegistry.addCallback>;
      const callback = addCallbackMock.mock.calls[0][1] as (event: unknown) => Promise<void>;
      await callback({});

      expect(mockStorage.loadMessages).toHaveBeenCalledWith(sessionConfig);
      expect(mockStorage.clearSession).toHaveBeenCalledWith(sessionConfig);
      expect(mockStorage.saveMessages).toHaveBeenCalledWith(
        sessionConfig,
        expect.arrayContaining([
          expect.objectContaining({ role: 'user' }), // Summary message
          expect.objectContaining({ role: 'assistant' }), // Acknowledgment
        ])
      );

      // Verify the saved messages include recent messages
      const saveMessagesMock = jest.mocked(mockStorage.saveMessages);
      const savedMessages = saveMessagesMock.mock.calls[0][1] as Message[];
      // 2 (summary + ack) + 3 (keepRecentMessages) = 5
      expect(savedMessages.length).toBe(5);
    });

    it('should handle errors gracefully and continue', async () => {
      jest.mocked(mockStorage.loadMessages).mockRejectedValue(new Error('Storage error'));

      const hook = new SessionCompactionHook(mockStorage, sessionConfig, compactionConfig, region);
      const mockRegistry = {
        addCallback: jest.fn(),
      } as unknown as HookRegistry;
      hook.registerCallbacks(mockRegistry);

      const addCallbackMock = mockRegistry.addCallback as jest.MockedFunction<typeof mockRegistry.addCallback>;
      const callback = addCallbackMock.mock.calls[0][1] as (event: unknown) => Promise<void>;

      // Should not throw
      await expect(callback({})).resolves.not.toThrow();
    });
  });
});



