import { z } from 'zod';

type JsonSchema = {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
};

/**
 * Convert Zod schema to JSON Schema
 *
 * Note: Complete conversion is complex, so this implementation is limited to Zod features used in the project.
 * Supports ZodObject and ZodDiscriminatedUnion (flattened into a merged object for LLM API compatibility).
 */
export function zodToJsonSchema(schema: z.ZodObject<z.ZodRawShape> | z.ZodType): JsonSchema {
  if (schema instanceof z.ZodDiscriminatedUnion) {
    return discriminatedUnionToJsonSchema(schema);
  }

  if (schema instanceof z.ZodObject) {
    return zodObjectToJsonSchema(schema);
  }

  throw new Error(`zodToJsonSchema: unsupported schema type "${schema.constructor.name}"`);
}

function zodObjectToJsonSchema(schema: z.ZodObject<z.ZodRawShape>): JsonSchema {
  const shape = schema.shape;
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
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
 * at the top level and generally don't support `oneOf`. This function merges all
 * variant properties into one flat object where only the discriminator is required
 * and all variant-specific fields are marked optional.
 */
function discriminatedUnionToJsonSchema(schema: z.ZodDiscriminatedUnion): JsonSchema {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const def = schema._def as any;
  const discriminator: string = def.discriminator;
  const options = def.options as z.ZodObject<z.ZodRawShape>[];

  const properties: Record<string, unknown> = {};
  const discriminatorValues: string[] = [];

  for (const option of options) {
    const shape = option.shape;
    for (const [key, value] of Object.entries(shape)) {
      if (key === discriminator) {
        // Collect literal values for the discriminator enum
        const zodType = value as z.ZodTypeAny;
        if (zodType instanceof z.ZodLiteral) {
          discriminatorValues.push(zodType.value as string);
        }
        continue;
      }
      // First occurrence wins (keeps description from the variant that defines it)
      if (!properties[key]) {
        properties[key] = convertZodType(value as z.ZodTypeAny);
      }
    }
  }

  // Build discriminator property as enum
  const firstDiscriminator = options[0]?.shape?.[discriminator] as z.ZodTypeAny | undefined;
  properties[discriminator] = {
    type: 'string',
    enum: discriminatorValues,
    ...(firstDiscriminator?.description ? { description: firstDiscriminator.description } : {}),
  };

  return {
    type: 'object',
    properties,
    required: [discriminator],
  };
}

/**
 * Extract check definitions from Zod v4 check objects.
 * Zod v4 stores check info in check._zod.def instead of check.kind/check.value.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getCheckDef(check: any): Record<string, unknown> {
  // Zod v4: check._zod.def contains { check: "kind", value/minimum/maximum: ... }
  if (check?._zod?.def) return check._zod.def;
  // Zod v3 fallback: check itself has { kind, value, ... }
  return check || {};
}

function convertZodType(zodType: z.ZodTypeAny): Record<string, unknown> {
  // Unwrap ZodOptional / ZodDefault
  let innerType = zodType;
  const description = zodType.description;
  let defaultValue: unknown;

  if (zodType instanceof z.ZodOptional) {
    innerType = zodType.unwrap() as z.ZodTypeAny;
  }
  if (zodType instanceof z.ZodDefault) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const defValue = (zodType._def as any).defaultValue;
    defaultValue = typeof defValue === 'function' ? defValue() : defValue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    innerType = (zodType._def as any).innerType;
  }

  const result: Record<string, unknown> = {};

  // Type conversion
  if (innerType instanceof z.ZodString) {
    result.type = 'string';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const checks = (innerType._def as any).checks || [];
    for (const check of checks) {
      const def = getCheckDef(check);
      // Zod v4: check="min_length" with minimum / check="max_length" with maximum
      // Zod v3: kind="min" with value / kind="max" with value
      if (def.check === 'min_length') result.minLength = def.minimum;
      else if (def.check === 'max_length') result.maxLength = def.maximum;
      else if (def.kind === 'min') result.minLength = def.value;
      else if (def.kind === 'max') result.maxLength = def.value;
    }
  } else if (innerType instanceof z.ZodNumber) {
    result.type = 'number';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const checks = (innerType._def as any).checks || [];
    for (const check of checks) {
      const def = getCheckDef(check);
      // Zod v4: check="greater_than" with value / check="less_than" with value
      // Zod v3: kind="min" with value / kind="max" with value
      if (def.check === 'greater_than') result.minimum = def.value;
      else if (def.check === 'less_than') result.maximum = def.value;
      else if (def.kind === 'min') result.minimum = def.value;
      else if (def.kind === 'max') result.maximum = def.value;
    }
  } else if (innerType instanceof z.ZodBoolean) {
    result.type = 'boolean';
  } else if (innerType instanceof z.ZodEnum) {
    result.type = 'string';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const def = innerType._def as any;
    // Zod v4: entries is { key: value } object; Zod v3: values is string[]
    result.enum = def.entries ? Object.values(def.entries) : def.values;
  } else if (innerType instanceof z.ZodArray) {
    result.type = 'array';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result.items = convertZodType((innerType._def as any).type);
  } else if (innerType instanceof z.ZodObject) {
    const nested = zodToJsonSchema(innerType);
    result.type = 'object';
    result.properties = nested.properties;
    if (nested.required) result.required = nested.required;
  } else if (innerType instanceof z.ZodLiteral) {
    const value = innerType.value;
    result.type = typeof value === 'number' ? 'number' : 'string';
    result.enum = [value];
  } else if (innerType instanceof z.ZodRecord) {
    result.type = 'object';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const valueDef = (innerType._def as any).valueType;
    if (valueDef) {
      result.additionalProperties = convertZodType(valueDef);
    }
  } else if (innerType instanceof z.ZodUnion) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options = (innerType._def as any).options as z.ZodTypeAny[];
    result.oneOf = options.map((opt) => convertZodType(opt));
  } else {
    result.type = 'string'; // Fallback
  }

  if (description) result.description = description;
  if (defaultValue !== undefined) result.default = defaultValue;

  return result;
}

function isOptional(zodType: z.ZodTypeAny): boolean {
  return zodType instanceof z.ZodOptional || zodType.isOptional();
}
