/**
 * Unit tests for conversation summarizer
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Message, TextBlock } from '@strands-agents/sdk';

// Store mock function reference
let mockSend: jest.Mock<() => Promise<unknown>>;

// Mock AWS SDK before imports
jest.unstable_mockModule('@aws-sdk/client-bedrock-runtime', () => {
  mockSend = jest.fn<() => Promise<unknown>>();
  return {
    BedrockRuntimeClient: jest.fn().mockImplementation(() => ({
      send: mockSend,
    })),
    ConverseCommand: jest.fn().mockImplementation((input) => input),
  };
});

// Mock logger
jest.unstable_mockModule('../../config/index.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Import after mocks are set up
const { generateSummary } = await import('../compaction/summarizer.js');

describe('generateSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createTestMessages = (): Message[] => [
    new Message({
      role: 'user',
      content: [new TextBlock('Hello, can you help me with a coding problem?')],
    }),
    new Message({
      role: 'assistant',
      content: [new TextBlock('Of course! I would be happy to help. What is the problem?')],
    }),
    new Message({
      role: 'user',
      content: [new TextBlock('I need to implement a sorting algorithm in Python.')],
    }),
    new Message({
      role: 'assistant',
      content: [
        new TextBlock(
          'Here is an example of a quicksort implementation...\n```python\ndef quicksort(arr):\n    pass\n```'
        ),
      ],
    }),
  ];

  it('should generate a summary from messages', async () => {
    const mockResponse = {
      output: {
        message: {
          content: [
            {
              text: 'The user asked for help with implementing a sorting algorithm in Python. The assistant provided a quicksort implementation.',
            },
          ],
        },
      },
    };
    mockSend.mockResolvedValue(mockResponse);

    const messages = createTestMessages();
    const summary = await generateSummary(messages, 'us-east-1');

    expect(summary).toContain('sorting algorithm');
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('should return empty string for empty messages array', async () => {
    const summary = await generateSummary([], 'us-east-1');
    expect(summary).toBe('');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('should throw error when response format is invalid', async () => {
    mockSend.mockResolvedValue({
      output: {
        message: {
          content: null,
        },
      },
    });

    const messages = createTestMessages();
    await expect(generateSummary(messages, 'us-east-1')).rejects.toThrow(
      'Invalid response format from summarizer model'
    );
  });

  it('should throw error when summary is empty', async () => {
    mockSend.mockResolvedValue({
      output: {
        message: {
          content: [{ text: '' }],
        },
      },
    });

    const messages = createTestMessages();
    await expect(generateSummary(messages, 'us-east-1')).rejects.toThrow('Empty summary generated');
  });

  it('should handle Bedrock API errors', async () => {
    mockSend.mockRejectedValue(new Error('Bedrock API error'));

    const messages = createTestMessages();
    await expect(generateSummary(messages, 'us-east-1')).rejects.toThrow('Bedrock API error');
  });
});


