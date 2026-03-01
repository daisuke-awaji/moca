import { z } from 'zod';

type JsonSchema = {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
};

// ---------------------------------------------------------------------------
// Zod v4 internal accessor — localizes all `_def as any` access
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function zodDef(zodType: z.ZodTypeAny): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return zodType._def as any;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Convert a Zod schema to JSON Schema.
 *
 * Supports ZodObject and ZodDiscriminatedUnion (flattened into a merged object
 * for LLM tool-calling API compatibility).
 */
export function zodToJsonSchema(schema: z.ZodObject<z.ZodRawShape> | z.ZodType): JsonSchema {
  if (schema instanceof z.ZodDiscriminatedUnion) {
    return discriminatedUnionToJsonSchema(schema);
  }
  if (schema instanceof z.ZodObject) {
    return objectToJsonSchema(schema);
  }
  throw new Error(`zodToJsonSchema: unsupported schema type "${schema.constructor.name}"`);
}

// ---------------------------------------------------------------------------
// Top-level schema converters
// ---------------------------------------------------------------------------

function objectToJsonSchema(schema: z.ZodObject<z.ZodRawShape>): JsonSchema {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(schema.shape)) {
    const zodType = value as z.ZodTypeAny;
    properties[key] = convertZodType(zodType);
    if (!isOptional(zodType)) {
      required.push(key);
    }
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

/**
 * Flatten a ZodDiscriminatedUnion into a single merged object schema.
 *
 * LLM tool-calling APIs (Bedrock Converse, OpenAI, etc.) require `type: "object"`
 * at the top level and generally don't support `oneOf`. This merges all variant
 * properties into one flat object where only the discriminator is required.
 */
function discriminatedUnionToJsonSchema(schema: z.ZodDiscriminatedUnion): JsonSchema {
  const { discriminator, options } = zodDef(schema) as {
    discriminator: string;
    options: z.ZodObject<z.ZodRawShape>[];
  };

  const properties: Record<string, unknown> = {};
  const discriminatorValues: string[] = [];

  for (const option of options) {
    for (const [key, value] of Object.entries(option.shape)) {
      if (key === discriminator) {
        const zodType = value as z.ZodTypeAny;
        if (zodType instanceof z.ZodLiteral) {
          discriminatorValues.push(zodType.value as string);
        }
        continue;
      }
      if (!properties[key]) {
        properties[key] = convertZodType(value as z.ZodTypeAny);
      }
    }
  }

  const firstDiscriminator = options[0]?.shape?.[discriminator] as z.ZodTypeAny | undefined;
  properties[discriminator] = {
    type: 'string',
    enum: discriminatorValues,
    ...(firstDiscriminator?.description ? { description: firstDiscriminator.description } : {}),
  };

  return { type: 'object', properties, required: [discriminator] };
}

// ---------------------------------------------------------------------------
// Per-type conversion (unwrap → convert inner type → attach metadata)
// ---------------------------------------------------------------------------

function convertZodType(zodType: z.ZodTypeAny): Record<string, unknown> {
  const { innerType, description, defaultValue } = unwrap(zodType);
  return {
    ...convertInnerType(innerType),
    ...(description ? { description } : {}),
    ...(defaultValue !== undefined ? { default: defaultValue } : {}),
  };
}

function unwrap(zodType: z.ZodTypeAny): {
  innerType: z.ZodTypeAny;
  description: string | undefined;
  defaultValue: unknown;
} {
  let innerType = zodType;
  let defaultValue: unknown;

  if (zodType instanceof z.ZodOptional) {
    innerType = zodType.unwrap() as z.ZodTypeAny;
  }
  if (zodType instanceof z.ZodDefault) {
    const def = zodDef(zodType);
    defaultValue = typeof def.defaultValue === 'function' ? def.defaultValue() : def.defaultValue;
    innerType = def.innerType;
  }

  return { innerType, description: zodType.description, defaultValue };
}

function convertInnerType(type: z.ZodTypeAny): Record<string, unknown> {
  if (type instanceof z.ZodString) return { type: 'string', ...stringChecks(type) };
  if (type instanceof z.ZodNumber) return { type: 'number', ...numberChecks(type) };
  if (type instanceof z.ZodBoolean) return { type: 'boolean' };
  if (type instanceof z.ZodEnum) return { type: 'string', enum: Object.values(zodDef(type).entries) };
  if (type instanceof z.ZodLiteral) return { type: typeof type.value === 'number' ? 'number' : 'string', enum: [type.value] };
  if (type instanceof z.ZodArray) return { type: 'array', items: convertZodType(zodDef(type).type) };
  if (type instanceof z.ZodObject) {
    const nested = objectToJsonSchema(type);
    return { type: 'object', properties: nested.properties, ...(nested.required ? { required: nested.required } : {}) };
  }
  if (type instanceof z.ZodRecord) return { type: 'object', additionalProperties: convertZodType(zodDef(type).valueType) };
  if (type instanceof z.ZodUnion) return { oneOf: (zodDef(type).options as z.ZodTypeAny[]).map(convertZodType) };
  return { type: 'string' };
}

// ---------------------------------------------------------------------------
// Zod v4 check extraction
// ---------------------------------------------------------------------------

function stringChecks(type: z.ZodString): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const check of zodDef(type).checks || []) {
    const def = check._zod.def;
    if (def.check === 'min_length') result.minLength = def.minimum;
    if (def.check === 'max_length') result.maxLength = def.maximum;
  }
  return result;
}

function numberChecks(type: z.ZodNumber): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const check of zodDef(type).checks || []) {
    const def = check._zod.def;
    if (def.check === 'greater_than') result.minimum = def.value;
    if (def.check === 'less_than') result.maximum = def.value;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isOptional(zodType: z.ZodTypeAny): boolean {
  return zodType instanceof z.ZodOptional || zodType.isOptional();
}
