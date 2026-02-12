/**
 * Common tool type definitions
 */

import { ToolInput, ToolResult } from '../types.js';

/**
 * Tool handler function type
 */
export type ToolHandler = (input: ToolInput) => Promise<ToolResult>;

/**
 * Tool definition structure
 */
export interface Tool {
  /** Tool name */
  name: string;
  /** Tool handler function */
  handler: ToolHandler;
  /** Tool description */
  description?: string;
  /** Tool version */
  version?: string;
  /** Tool tags */
  tags?: string[];
}

/**
 * Base tool error
 */
export class ToolError extends Error {
  constructor(
    message: string,
    public readonly toolName: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ToolError';
  }
}

/**
 * Input validation error
 */
export class ToolValidationError extends ToolError {
  constructor(
    message: string,
    toolName: string,
    public readonly field?: string
  ) {
    super(message, toolName);
    this.name = 'ToolValidationError';
  }
}

/**
 * Access denied error (database/table not in allow list)
 */
export class AccessDeniedError extends ToolError {
  constructor(
    message: string,
    toolName: string,
    public readonly resource?: string
  ) {
    super(message, toolName);
    this.name = 'AccessDeniedError';
  }
}
