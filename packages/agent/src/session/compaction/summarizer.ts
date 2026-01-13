/**
 * Conversation summarizer for session compaction
 * Uses LLM to generate concise summaries of conversation history
 */

import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import type { Message } from '@strands-agents/sdk';
import { logger } from '../../config/index.js';

/** Model to use for summarization (lightweight model for cost efficiency) */
const SUMMARIZER_MODEL_ID = 'anthropic.claude-3-haiku-20240307-v1:0';

/** Maximum tokens for summary output */
const MAX_SUMMARY_TOKENS = 2048;

/** Prompt template for summarization */
const SUMMARIZE_PROMPT = `You are a conversation summarizer. Your task is to create a concise but comprehensive summary of the following conversation history.

Requirements:
- Preserve all key information, decisions made, and important context
- Include any technical details, code snippets discussed, or specific configurations mentioned
- Maintain chronological order of significant events
- Keep the summary focused and actionable for continuing the conversation
- Write in a clear, structured format

Conversation to summarize:
<conversation>
{messages}
</conversation>

Provide a comprehensive summary:`;

/**
 * Extract text content from a message
 */
function extractTextFromMessage(message: Message): string {
  const content = message.content;
  if (!content || !Array.isArray(content)) {
    return '';
  }

  const textParts: string[] = [];
  for (const block of content) {
    if (block && typeof block === 'object') {
      if ('text' in block && typeof block.text === 'string') {
        textParts.push(block.text);
      } else if ('toolUse' in block && block.toolUse) {
        // Include tool usage information
        const toolUse = block.toolUse as { name?: string; input?: unknown };
        textParts.push(`[Tool: ${toolUse.name || 'unknown'}]`);
      } else if ('toolResult' in block && block.toolResult) {
        // Include tool result summary
        textParts.push('[Tool Result]');
      }
    }
  }

  return textParts.join(' ');
}

/**
 * Format messages for summarization prompt
 */
function formatMessagesForPrompt(messages: Message[]): string {
  return messages
    .map((msg) => {
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      const text = extractTextFromMessage(msg);
      // Truncate very long messages to prevent prompt overflow
      const truncatedText = text.length > 2000 ? text.substring(0, 2000) + '...' : text;
      return `${role}: ${truncatedText}`;
    })
    .join('\n\n');
}

/**
 * Generate a summary of conversation messages using LLM
 * @param messages Messages to summarize
 * @param region AWS region for Bedrock
 * @returns Generated summary text
 */
export async function generateSummary(messages: Message[], region: string): Promise<string> {
  if (messages.length === 0) {
    return '';
  }

  logger.info('[Summarizer] Starting summary generation', {
    messageCount: messages.length,
    region,
  });

  const client = new BedrockRuntimeClient({ region });

  const conversationText = formatMessagesForPrompt(messages);
  const prompt = SUMMARIZE_PROMPT.replace('{messages}', conversationText);

  try {
    const response = await client.send(
      new ConverseCommand({
        modelId: SUMMARIZER_MODEL_ID,
        messages: [
          {
            role: 'user',
            content: [{ text: prompt }],
          },
        ],
        inferenceConfig: {
          maxTokens: MAX_SUMMARY_TOKENS,
          temperature: 0.3,
        },
      })
    );

    // Extract text from response
    const outputContent = response.output?.message?.content;
    if (!outputContent || !Array.isArray(outputContent)) {
      throw new Error('Invalid response format from summarizer model');
    }

    let summaryText = '';
    for (const block of outputContent) {
      if (block && typeof block === 'object' && 'text' in block && typeof block.text === 'string') {
        summaryText += block.text;
      }
    }

    if (!summaryText) {
      throw new Error('Empty summary generated');
    }

    logger.info('[Summarizer] Summary generation completed', {
      originalMessages: messages.length,
      summaryLength: summaryText.length,
    });

    return summaryText;
  } catch (error) {
    logger.error('[Summarizer] Failed to generate summary', { error });
    throw error;
  }
}
