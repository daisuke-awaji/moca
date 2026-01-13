/**
 * Session compaction types
 */

/**
 * Configuration for session compaction
 */
export interface CompactionConfig {
  /** Whether compaction is enabled */
  enabled: boolean;
  /** Message count threshold to trigger compaction */
  messageThreshold: number;
  /** Number of recent messages to keep after compaction */
  keepRecentMessages: number;
}

/**
 * Default compaction configuration
 */
export const DEFAULT_COMPACTION_CONFIG: CompactionConfig = {
  enabled: false,
  messageThreshold: 50,
  keepRecentMessages: 10,
};
