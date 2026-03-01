/**
 * generate_ui tool - Generate rich UI components for chat display
 *
 * Two modes:
 * - "spec": AI provides a json-render UI spec directly
 * - "code": AI provides code that generates a UI spec via CodeInterpreter
 */

import { tool } from '@strands-agents/sdk';
import { logger } from '../../config/index.js';
import { AgentCoreCodeInterpreterClient } from '../code-interpreter/client.js';
import { getCurrentStoragePath } from '../../context/request-context.js';
import { generateUiDefinition, type GenerateUiInput } from '@moca/tool-definitions';
import { validateUISpec } from './catalog.js';
import { isUISpec } from './types.js';
import type { UISpecOutput } from './types.js';

/**
 * Extract JSON spec from CodeInterpreter output.
 *
 * The output may be:
 *  - A raw JSON UI spec string: '{"root":"main","elements":{...}}'
 *  - A CodeInterpreter content array: '[{"type":"text","text":"{...}"}]'
 *  - Mixed text with embedded JSON
 */
function extractJsonFromOutput(output: string): unknown {
  // Try to parse the entire output as JSON first
  try {
    const parsed = JSON.parse(output.trim());

    // If it's already a valid UI spec, return directly
    if (isUISpec(parsed)) {
      return parsed;
    }

    // If it's an array (CodeInterpreter response envelope), unwrap text items
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item && typeof item === 'object') {
          // Handle {type:"text", text:"..."} format
          const textValue = item.text || item.resource?.text;
          if (typeof textValue === 'string') {
            const nested = extractJsonFromOutput(textValue);
            if (nested && isUISpec(nested)) {
              return nested;
            }
          }
        }
      }
    }

    // Return whatever we parsed (caller will validate)
    return parsed;
  } catch {
    // Look for the last JSON object in the output
    const jsonMatches = output.match(/\{[\s\S]*\}/g);
    if (jsonMatches && jsonMatches.length > 0) {
      // Try from the last match (most likely to be the spec)
      for (let i = jsonMatches.length - 1; i >= 0; i--) {
        try {
          const parsed = JSON.parse(jsonMatches[i]);
          if (isUISpec(parsed)) {
            return parsed;
          }
        } catch {
          continue;
        }
      }
    }
    return null;
  }
}

/**
 * Execute spec mode: use the provided UI spec directly.
 */
function handleSpecMode(input: Extract<GenerateUiInput, { mode: 'spec' }>): unknown {
  return input.spec;
}

/**
 * Execute code mode: delegate to CodeInterpreter and parse the output.
 */
async function handleCodeMode(
  input: Extract<GenerateUiInput, { mode: 'code' }>
): Promise<{ specData: unknown } | { error: string }> {
  const language = input.language || 'python';
  const sessionName = input.sessionName || `generate-ui-${Date.now()}`;

  logger.info(`🎨 generate_ui code mode: language=${language}, session=${sessionName}`);

  const storagePath = getCurrentStoragePath();
  const client = new AgentCoreCodeInterpreterClient({
    autoCreate: true,
    persistSessions: true,
    storagePath: storagePath,
    sessionName,
  });

  const result = await client.executeCode({
    action: 'executeCode',
    sessionName,
    language: language as 'python' | 'javascript' | 'typescript',
    code: input.code,
  });

  if (result.status === 'error') {
    const errorText = result.content.map((c) => c.text || JSON.stringify(c.json)).join('\n');
    logger.error(`🎨 generate_ui code execution failed: ${errorText}`);
    return { error: `Code execution failed: ${errorText}` };
  }

  const outputText = result.content
    .map((c) => c.text || (c.json ? JSON.stringify(c.json) : ''))
    .join('\n');

  logger.info(`🎨 generate_ui code output length: ${outputText.length}`);

  const specData = extractJsonFromOutput(outputText);
  if (!specData) {
    logger.error(`🎨 generate_ui failed to parse spec from code output`);
    return {
      error:
        'Failed to parse UI spec from code output. Make sure the code prints valid JSON to stdout.',
    };
  }

  return { specData };
}

/**
 * generate_ui Tool
 */
export const generateUiTool = tool({
  name: generateUiDefinition.name,
  description: generateUiDefinition.description,
  inputSchema: generateUiDefinition.zodSchema,
  callback: async (rawInput) => {
    const input = rawInput as GenerateUiInput;
    logger.info(`🎨 generate_ui execution started: mode=${input.mode}`);

    try {
      let specData: unknown;

      if (input.mode === 'spec') {
        specData = handleSpecMode(input);
      } else {
        // input.mode === 'code' — exhaustive via discriminated union
        const result = await handleCodeMode(input);
        if ('error' in result) {
          return JSON.stringify({ error: result.error });
        }
        specData = result.specData;
      }

      // Validate spec
      const validation = validateUISpec(specData);
      if (validation.errors.length > 0) {
        logger.warn(`🎨 generate_ui spec validation warnings: ${validation.errors.join(', ')}`);
      }

      if (!validation.spec) {
        return JSON.stringify({
          error: `Invalid UI spec: ${validation.errors.join(', ')}`,
        });
      }

      const output: UISpecOutput = {
        __generative_ui_spec: true,
        spec: validation.spec,
      };

      logger.info(
        `✅ generate_ui success: ${Object.keys(validation.spec.elements).length} elements`
      );

      return JSON.stringify(output);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`❌ generate_ui error: ${errorMessage}`);
      return JSON.stringify({
        error: `generate_ui failed: ${errorMessage}`,
      });
    }
  },
});
