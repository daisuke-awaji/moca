/**
 * Type definitions for the generate_ui tool
 */

/**
 * Supported component types in the moca UI catalog
 */
export const MOCA_COMPONENT_TYPES = ['Stack', 'Grid', 'DataTable', 'MetricCard'] as const;
export type MocaComponentType = (typeof MOCA_COMPONENT_TYPES)[number];

/**
 * UI Element in the flat element tree
 */
export interface UIElement {
  type: string;
  props?: Record<string, unknown>;
  children?: string[];
  visible?: unknown;
}

/**
 * json-render spec format (flat element tree)
 */
export interface UISpec {
  root: string;
  elements: Record<string, UIElement>;
}

/**
 * Marker wrapper for moca UI spec (used as tool output)
 */
export interface MocaUISpecOutput {
  __moca_ui_spec: true;
  spec: UISpec;
}

/**
 * Blocked props for security
 */
export const BLOCKED_PROPS = [
  'onClick',
  'onLoad',
  'onError',
  'onMouseOver',
  'onMouseOut',
  'onFocus',
  'onBlur',
  'onSubmit',
  'onKeyDown',
  'onKeyUp',
  'onKeyPress',
  'dangerouslySetInnerHTML',
] as const;
