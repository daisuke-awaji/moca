import { z } from 'zod';
import { zodToJsonSchema } from '../utils/schema-converter';

describe('zodToJsonSchema', () => {
  describe('ZodObject', () => {
    it('converts a simple object with required string field', () => {
      const schema = z.object({
        name: z.string(),
      });
      expect(zodToJsonSchema(schema)).toEqual({
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      });
    });

    it('marks optional fields as not required', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number().optional(),
      });
      const result = zodToJsonSchema(schema);
      expect(result.required).toEqual(['name']);
      expect(result.properties).toHaveProperty('age');
    });

    it('omits required key when all fields are optional', () => {
      const schema = z.object({
        a: z.string().optional(),
        b: z.number().optional(),
      });
      const result = zodToJsonSchema(schema);
      expect(result.required).toBeUndefined();
    });

    it('converts number type with min/max checks', () => {
      const schema = z.object({
        value: z.number().min(0).max(100),
      });
      const result = zodToJsonSchema(schema);
      const prop = result.properties['value'] as Record<string, unknown>;
      expect(prop.type).toBe('number');
      expect(prop.minimum).toBe(0);
      expect(prop.maximum).toBe(100);
    });

    it('converts string type with min/max length checks', () => {
      const schema = z.object({
        text: z.string().min(1).max(255),
      });
      const result = zodToJsonSchema(schema);
      const prop = result.properties['text'] as Record<string, unknown>;
      expect(prop.type).toBe('string');
      expect(prop.minLength).toBe(1);
      expect(prop.maxLength).toBe(255);
    });

    it('converts boolean type', () => {
      const schema = z.object({
        flag: z.boolean(),
      });
      const result = zodToJsonSchema(schema);
      expect((result.properties['flag'] as Record<string, unknown>).type).toBe('boolean');
    });

    it('converts enum type', () => {
      const schema = z.object({
        status: z.enum(['active', 'inactive']),
      });
      const result = zodToJsonSchema(schema);
      const prop = result.properties['status'] as Record<string, unknown>;
      expect(prop.type).toBe('string');
      expect(prop.enum).toEqual(['active', 'inactive']);
    });

    it('converts array type', () => {
      const schema = z.object({
        tags: z.array(z.string()),
      });
      const result = zodToJsonSchema(schema);
      const prop = result.properties['tags'] as Record<string, unknown>;
      expect(prop.type).toBe('array');
      expect(prop.items).toEqual({ type: 'string' });
    });

    it('converts nested object type', () => {
      const schema = z.object({
        address: z.object({
          city: z.string(),
          zip: z.string().optional(),
        }),
      });
      const result = zodToJsonSchema(schema);
      const prop = result.properties['address'] as Record<string, unknown>;
      expect(prop.type).toBe('object');
      expect(prop.properties).toEqual({
        city: { type: 'string' },
        zip: { type: 'string' },
      });
      expect(prop.required).toEqual(['city']);
    });

    it('converts union type to oneOf', () => {
      const schema = z.object({
        value: z.union([z.string(), z.number()]),
      });
      const result = zodToJsonSchema(schema);
      const prop = result.properties['value'] as Record<string, unknown>;
      expect(prop.oneOf).toEqual([{ type: 'string' }, { type: 'number' }]);
    });

    it('preserves description', () => {
      const schema = z.object({
        name: z.string().describe('The user name'),
      });
      const result = zodToJsonSchema(schema);
      expect((result.properties['name'] as Record<string, unknown>).description).toBe(
        'The user name'
      );
    });

    it('converts default values', () => {
      const schema = z.object({
        limit: z.number().default(10),
      });
      const result = zodToJsonSchema(schema);
      const prop = result.properties['limit'] as Record<string, unknown>;
      expect(prop.default).toBe(10);
    });

    it('converts literal type', () => {
      const schema = z.object({
        type: z.literal('fixed'),
      });
      const result = zodToJsonSchema(schema);
      const prop = result.properties['type'] as Record<string, unknown>;
      expect(prop.type).toBe('string');
      expect(prop.enum).toEqual(['fixed']);
    });

    it('converts record type', () => {
      const schema = z.object({
        metadata: z.record(z.string(), z.number()),
      });
      const result = zodToJsonSchema(schema);
      const prop = result.properties['metadata'] as Record<string, unknown>;
      expect(prop.type).toBe('object');
      expect(prop.additionalProperties).toEqual({ type: 'number' });
    });

    it('preserves description on optional fields', () => {
      const schema = z.object({
        name: z.string().optional().describe('Optional name'),
      });
      const result = zodToJsonSchema(schema);
      const prop = result.properties['name'] as Record<string, unknown>;
      expect(prop.type).toBe('string');
      expect(prop.description).toBe('Optional name');
    });

    it('converts literal type with number value', () => {
      const schema = z.object({
        version: z.literal(42),
      });
      const result = zodToJsonSchema(schema);
      const prop = result.properties['version'] as Record<string, unknown>;
      expect(prop.type).toBe('number');
      expect(prop.enum).toEqual([42]);
    });

    it('falls back to string type for unknown Zod types', () => {
      const schema = z.object({
        data: z.unknown(),
      });
      const result = zodToJsonSchema(schema);
      const prop = result.properties['data'] as Record<string, unknown>;
      expect(prop.type).toBe('string');
    });

    it('handles empty object schema', () => {
      const schema = z.object({});
      expect(zodToJsonSchema(schema)).toEqual({
        type: 'object',
        properties: {},
      });
    });
  });

  describe('ZodDiscriminatedUnion', () => {
    const schema = z.discriminatedUnion('mode', [
      z.object({
        mode: z.literal('spec').describe('Execution mode'),
        spec: z.record(z.string(), z.unknown()).describe('UI spec object'),
      }),
      z.object({
        mode: z.literal('code').describe('Execution mode'),
        code: z.string().describe('Source code'),
        language: z.enum(['python', 'typescript']).optional().describe('Language'),
      }),
    ]);

    it('returns type: "object" (LLM API compatible)', () => {
      const result = zodToJsonSchema(schema);
      expect(result.type).toBe('object');
    });

    it('sets only the discriminator as required', () => {
      const result = zodToJsonSchema(schema);
      expect(result.required).toEqual(['mode']);
    });

    it('builds discriminator property as enum of all literal values', () => {
      const result = zodToJsonSchema(schema);
      const modeProp = result.properties['mode'] as Record<string, unknown>;
      expect(modeProp.type).toBe('string');
      expect(modeProp.enum).toEqual(['spec', 'code']);
    });

    it('preserves discriminator description', () => {
      const result = zodToJsonSchema(schema);
      const modeProp = result.properties['mode'] as Record<string, unknown>;
      expect(modeProp.description).toBe('Execution mode');
    });

    it('merges properties from all variants', () => {
      const result = zodToJsonSchema(schema);
      const keys = Object.keys(result.properties);
      expect(keys).toContain('mode');
      expect(keys).toContain('spec');
      expect(keys).toContain('code');
      expect(keys).toContain('language');
    });

    it('preserves description on variant-specific fields', () => {
      const result = zodToJsonSchema(schema);
      expect((result.properties['spec'] as Record<string, unknown>).description).toBe(
        'UI spec object'
      );
      expect((result.properties['code'] as Record<string, unknown>).description).toBe(
        'Source code'
      );
    });

    it('first occurrence wins for duplicate property names', () => {
      const dupeSchema = z.discriminatedUnion('kind', [
        z.object({
          kind: z.literal('a'),
          shared: z.string().describe('from variant a'),
        }),
        z.object({
          kind: z.literal('b'),
          shared: z.number().describe('from variant b'),
        }),
      ]);
      const result = zodToJsonSchema(dupeSchema);
      const shared = result.properties['shared'] as Record<string, unknown>;
      expect(shared.type).toBe('string');
      expect(shared.description).toBe('from variant a');
    });

    it('omits description when discriminator has no describe()', () => {
      const schema = z.discriminatedUnion('type', [
        z.object({ type: z.literal('x'), x: z.string() }),
        z.object({ type: z.literal('y'), y: z.number() }),
      ]);
      const result = zodToJsonSchema(schema);
      const typeProp = result.properties['type'] as Record<string, unknown>;
      expect(typeProp.enum).toEqual(['x', 'y']);
      expect(typeProp).not.toHaveProperty('description');
    });
  });

  describe('unsupported schema types', () => {
    it('throws for a plain z.string()', () => {
      expect(() => zodToJsonSchema(z.string() as never)).toThrow('unsupported schema type');
    });
  });
});
