/**
 * Type definitions for the generate_ui tool
 */

import { COMPONENT_NAMES } from '@moca/generative-ui-catalog';

/**
 * Supported component types in the UI catalog — derived from the shared catalog (SSoT).
 */
export const UI_COMPONENT_TYPES = COMPONENT_NAMES;
export type UIComponentType = (typeof UI_COMPONENT_TYPES)[number];

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
 * Marker wrapper for generative UI spec (used as tool output)
 */
export interface UISpecOutput {
  __generative_ui_spec: true;
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
