/**
 * moca UI catalog validation
 *
 * Validates that a UI spec only uses registered components
 * and sanitizes props for security.
 */

import type { UISpec, UIElement } from './types.js';
import { MOCA_COMPONENT_TYPES, BLOCKED_PROPS } from './types.js';

/**
 * Sanitize props by removing blocked event handlers
 */
function sanitizeProps(props: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (BLOCKED_PROPS.includes(key as (typeof BLOCKED_PROPS)[number])) {
      continue;
    }
    // Block href/src with javascript: protocol
    if ((key === 'href' || key === 'src') && typeof value === 'string') {
      if (value.trim().toLowerCase().startsWith('javascript:')) {
        continue;
      }
    }
    sanitized[key] = value;
  }
  return sanitized;
}

/**
 * Validate and sanitize a UI element
 */
function validateElement(key: string, element: UIElement): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!MOCA_COMPONENT_TYPES.includes(element.type as (typeof MOCA_COMPONENT_TYPES)[number])) {
    errors.push(`Unknown component type "${element.type}" in element "${key}"`);
  }

  if (element.props) {
    element.props = sanitizeProps(element.props);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate and sanitize a complete UI spec
 */
export function validateUISpec(spec: unknown): {
  valid: boolean;
  spec: UISpec | null;
  errors: string[];
} {
  const errors: string[] = [];

  if (!spec || typeof spec !== 'object') {
    return { valid: false, spec: null, errors: ['Spec must be an object'] };
  }

  const s = spec as Record<string, unknown>;

  if (typeof s.root !== 'string') {
    return { valid: false, spec: null, errors: ['Spec must have a "root" string key'] };
  }

  if (!s.elements || typeof s.elements !== 'object') {
    return { valid: false, spec: null, errors: ['Spec must have an "elements" object'] };
  }

  const elements = s.elements as Record<string, UIElement>;

  if (!elements[s.root]) {
    errors.push(`Root element "${s.root}" not found in elements`);
  }

  // Validate each element
  for (const [key, element] of Object.entries(elements)) {
    const result = validateElement(key, element);
    errors.push(...result.errors);

    // Validate children references
    if (element.children) {
      for (const childKey of element.children) {
        if (!elements[childKey]) {
          errors.push(`Element "${key}" references unknown child "${childKey}"`);
        }
      }
    }
  }

  // Allow spec with warnings (unknown types are filtered on frontend)
  const uiSpec: UISpec = {
    root: s.root,
    elements,
  };

  return { valid: errors.length === 0, spec: uiSpec, errors };
}
