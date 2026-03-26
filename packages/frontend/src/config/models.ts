/**
 * Available Bedrock Models Configuration
 *
 * Models are configured via VITE_BEDROCK_MODELS environment variable (set by CDK).
 * Falls back to default global.* models if not provided.
 */

export interface BedrockModel {
  id: string;
  name: string;
  provider: 'Anthropic' | 'Amazon';
}

const FALLBACK_MODELS: readonly BedrockModel[] = [
  { id: 'global.anthropic.claude-opus-4-6-v1', name: 'Claude Opus 4.6', provider: 'Anthropic' },
  { id: 'global.anthropic.claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'Anthropic' },
  { id: 'global.amazon.nova-2-lite-v1:0', name: 'Nova Lite 2', provider: 'Amazon' },
];

function loadModels(): readonly BedrockModel[] {
  try {
    const raw = import.meta.env.VITE_BEDROCK_MODELS;
    if (!raw) return FALLBACK_MODELS;
    const parsed = JSON.parse(raw) as BedrockModel[];
    return parsed.length > 0 ? parsed : FALLBACK_MODELS;
  } catch {
    return FALLBACK_MODELS;
  }
}

/**
 * Available Bedrock models (from CDK environment config or fallback)
 */
export const AVAILABLE_MODELS: readonly BedrockModel[] = loadModels();

/**
 * Default model ID (first model in the list)
 */
export const DEFAULT_MODEL_ID = AVAILABLE_MODELS[0]?.id ?? 'global.anthropic.claude-sonnet-4-6';

/**
 * Get model by ID
 */
export function getModelById(id: string): BedrockModel | undefined {
  return AVAILABLE_MODELS.find((model) => model.id === id);
}

/**
 * Get model display name
 */
export function getModelDisplayName(id: string): string {
  const model = getModelById(id);
  return model ? `${model.name} (${model.provider})` : id;
}
