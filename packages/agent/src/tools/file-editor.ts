/**
 * File Editor Tool - Safely edit or create files
 */

import { tool } from '@strands-agents/sdk';
import { z } from 'zod';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { logger } from '../config/index.js';
import { getCurrentContext } from '../context/request-context.js';

/**
 * Check if oldString appears exactly once in the file content
 */
function isSingleOccurrence(str: string, substr: string): boolean | undefined {
  const first = str.indexOf(substr);
  if (first === -1) return undefined; // Not found
  const last = str.lastIndexOf(substr);
  return first === last; // True if only one occurrence
}

/**
 * File Editor Tool
 */
export const fileEditorTool = tool({
  name: 'file_editor',
  description: `
This tool edits files. For moving/renaming, use the execute_command tool with 'mv' instead.

Before using:
1. Use execute_command with 'cat' to understand file contents/context
2. For new files: verify directory path with 'ls' command

The tool replaces ONE occurrence of oldString with newString.

CRITICAL REQUIREMENTS:

1. UNIQUENESS: oldString must uniquely identify the change:
   - Include 3-5 lines before change
   - Include 3-5 lines after change
   - Match whitespace/indentation exactly

2. SINGLE INSTANCE: One change per call:
   - Separate calls for multiple instances
   - Each needs unique context

3. VERIFY FIRST:
   - Check instance count
   - Gather context for multiple instances
   - Plan separate calls

WARNINGS:
- Fails on multiple matches
- Fails on inexact matches
- Wrong changes if context insufficient

Best Practices:
- Write idiomatic, working code
- Don't break code
- Use absolute paths
- For new files: empty oldString, contents as newString
- Bundle multiple edits to same file in one message
`,
  inputSchema: z.object({
    filePath: z
      .string()
      .describe('The absolute path to the file to modify (must be absolute, not relative)'),
    oldString: z
      .string()
      .describe(
        'The text to replace (must be unique within the file, and must match the file contents exactly, including all whitespace and indentation)'
      ),
    newString: z.string().describe('The edited text to replace the oldString'),
  }),
  callback: async (input) => {
    const { filePath, oldString, newString } = input;

    logger.info(`📝 File editor operation started: ${filePath}`);

    try {
      // Wait for workspace sync to complete
      const context = getCurrentContext();
      if (context?.workspaceSync) {
        await context.workspaceSync.waitForInitialSync();
      }

      // Check if file exists
      const fileExists = existsSync(filePath);

      if (!fileExists) {
        // File doesn't exist
        if (oldString) {
          const msg = `The file does not exist. Please check again.`;
          logger.warn(`⚠️ ${msg} - Path: ${filePath}`);
          return msg;
        }
        // Create new file with newString content
        writeFileSync(filePath, newString, 'utf8');
        logger.info(`✅ Successfully created the file: ${filePath}`);
        return 'successfully created the file.';
      }

      // File exists - check if we can edit
      if (!oldString) {
        const msg = `The file already exists. Please provide a non-empty oldString to edit it.`;
        logger.warn(`⚠️ ${msg} - Path: ${filePath}`);
        return msg;
      }

      // Read file contents
      const fileContents = readFileSync(filePath, 'utf8');

      // Check if oldString exists and appears only once
      const isValid = isSingleOccurrence(fileContents, oldString);

      if (isValid === undefined) {
        const msg = `The file does not contain the oldString. Please check again.`;
        logger.warn(`⚠️ ${msg} - Path: ${filePath}`);
        return msg;
      }

      if (!isValid) {
        const msg = `The file contains multiple occurrences of the oldString. Only one occurrence is allowed.`;
        logger.warn(`⚠️ ${msg} - Path: ${filePath}`);
        return msg;
      }

      // Replace oldString with newString
      const updatedContents = fileContents.replace(oldString, newString);
      writeFileSync(filePath, updatedContents, 'utf8');

      logger.info(`✅ Successfully edited the file: ${filePath}`);
      return 'successfully edited the file.';
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`❌ File editor error: ${filePath}`, errorMsg);
      return `Error editing file: ${errorMsg}`;
    }
  },
});
