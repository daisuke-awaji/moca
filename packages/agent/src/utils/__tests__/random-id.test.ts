import { describe, it, expect } from '@jest/globals';
import { randomId, customAlphabetId } from '../random-id.js';

describe('randomId', () => {
  it('should generate a string of default length 21', () => {
    const id = randomId();
    expect(id).toHaveLength(21);
  });

  it('should generate a string of specified length', () => {
    expect(randomId(10)).toHaveLength(10);
    expect(randomId(33)).toHaveLength(33);
    expect(randomId(1)).toHaveLength(1);
  });

  it('should generate unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => randomId()));
    expect(ids.size).toBe(100);
  });

  it('should only contain URL-safe characters', () => {
    for (let i = 0; i < 50; i++) {
      const id = randomId();
      expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });
});

describe('customAlphabetId', () => {
  it('should generate IDs with the given alphabet', () => {
    const generate = customAlphabetId('abc', 10);
    for (let i = 0; i < 50; i++) {
      const id = generate();
      expect(id).toHaveLength(10);
      expect(id).toMatch(/^[abc]+$/);
    }
  });

  it('should respect the default size', () => {
    const generate = customAlphabetId('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 33);
    expect(generate()).toHaveLength(33);
  });

  it('should allow overriding size per call', () => {
    const generate = customAlphabetId('0123456789', 10);
    expect(generate(5)).toHaveLength(5);
    expect(generate(20)).toHaveLength(20);
  });

  it('should generate unique IDs', () => {
    const generate = customAlphabetId(
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
      33
    );
    const ids = new Set(Array.from({ length: 100 }, () => generate()));
    expect(ids.size).toBe(100);
  });
});
