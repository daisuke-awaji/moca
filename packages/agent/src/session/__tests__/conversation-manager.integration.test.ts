/**
 * Conversation Manager Integration Tests
 *
 * These tests verify that SlidingWindowConversationManager correctly manages
 * conversation history to prevent token overflow errors with actual Bedrock API calls.
 *
 * Valid AWS credentials and Bedrock model access are required.
 *
 * Run with:
 *   cd packages/agent
 *   node --experimental-vm-modules ../../node_modules/.bin/jest \
 *     --config jest.integration.config.js --no-coverage conversation-manager
 */

import { describe, it, expect } from '@jest/globals';
import { Agent, Message, TextBlock, SlidingWindowConversationManager } from '@strands-agents/sdk';
import { createBedrockModel } from '../../models/bedrock.js';

// Use the same default model as config (global.anthropic.claude-sonnet-4-6)
// No need to set BEDROCK_MODEL_ID env var — it picks up from .env or config default.

/**
 * Generate a large conversation history with user/assistant message pairs.
 * Each message contains enough text to consume significant tokens.
 */
function generateLargeConversationHistory(pairCount: number, textLength: number = 800): Message[] {
  const messages: Message[] = [];
  for (let i = 0; i < pairCount; i++) {
    const userText =
      `Question ${i + 1}: Please explain topic number ${i + 1}. ` +
      'Lorem ipsum dolor sit amet. '.repeat(Math.ceil(textLength / 28));
    const assistantText =
      `Answer ${i + 1}: Here is my explanation of topic ${i + 1}. ` +
      'The quick brown fox jumps over the lazy dog. '.repeat(Math.ceil(textLength / 45));

    messages.push(
      new Message({
        role: 'user',
        content: [new TextBlock(userText)],
      })
    );
    messages.push(
      new Message({
        role: 'assistant',
        content: [new TextBlock(assistantText)],
      })
    );
  }
  return messages;
}

describe('SlidingWindowConversationManager Integration', () => {
  it('should handle long conversation history without token overflow', async () => {
    // Generate 100 message pairs (~200 messages, each ~800 chars ~ 200 tokens)
    const history = generateLargeConversationHistory(100, 800);

    console.log(`Generated ${history.length} messages for conversation history`);

    const model = createBedrockModel();

    const conversationManager = new SlidingWindowConversationManager({
      windowSize: 40,
      shouldTruncateResults: true,
    });

    const agent = new Agent({
      model,
      systemPrompt: 'You are a helpful assistant. Respond briefly.',
      tools: [],
      messages: history,
      conversationManager,
    });

    console.log(`Agent initialized with ${agent.messages.length} messages`);

    // Send a new message using stream - this should NOT throw "prompt is too long"
    for await (const event of agent.stream('What is 2 + 2? Answer in one word.')) {
      // Consume stream events
      void event;
    }

    console.log(`Messages after response: ${agent.messages.length}`);

    // Verify: agent responded successfully (messages array should have assistant response)
    const lastMessage = agent.messages[agent.messages.length - 1];
    expect(lastMessage).toBeDefined();
    expect(lastMessage.role).toBe('assistant');

    // Verify: messages were trimmed to around windowSize
    // windowSize=40 + new user message + new assistant message = ~42 max
    expect(agent.messages.length).toBeLessThanOrEqual(50);

    console.log('Test passed: conversation manager prevented token overflow');
  });
});
