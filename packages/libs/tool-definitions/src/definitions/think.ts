import { z } from 'zod';
import { defineToolDefinition } from '../types.js';

export const thinkSchema = z.object({
  thought: z
    .string()
    .describe(
      'Your internal reasoning, analysis, or planning. Use this to think through complex problems step-by-step, evaluate tool results, plan next actions, or verify assumptions before proceeding.'
    ),
});

export const thinkDefinition = defineToolDefinition({
  name: 'think',
  description:
    'Use this tool to think through a problem step-by-step before taking action. ' +
    'This is especially useful when you need to analyze tool results, plan multi-step tasks, ' +
    'verify your reasoning, or decide between multiple approaches. ' +
    'This tool does not execute anything — it simply provides space for structured reasoning.',
  zodSchema: thinkSchema,
});
