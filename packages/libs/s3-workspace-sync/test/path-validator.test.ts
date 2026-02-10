import { describe, it, expect } from 'vitest';
import { validateStoragePath } from '../src/utils/path-validator.js';
import { PathValidationError } from '../src/errors.js';

describe('validateStoragePath', () => {
  describe('valid paths', () => {
    it.each([
      'workspace',
      'my-workspace',
      'user/workspace',
      'dev01/deck',
      'a/b/c/d',
      'file.txt',
      'path/to/file.txt',
      '',
      '/',
    ])('accepts "%s"', (path) => {
      expect(() => validateStoragePath(path)).not.toThrow();
    });
  });

  describe('path traversal', () => {
    it('rejects ".." sequences', () => {
      expect(() => validateStoragePath('../etc/passwd')).toThrow(PathValidationError);
      expect(() => validateStoragePath('foo/../../bar')).toThrow(PathValidationError);
      expect(() => validateStoragePath('..')).toThrow(PathValidationError);
    });
  });

  describe('null bytes', () => {
    it('rejects null bytes', () => {
      expect(() => validateStoragePath('foo\0bar')).toThrow(PathValidationError);
    });
  });

  describe('invalid characters', () => {
    it.each([
      'path with spaces',
      'path@special',
      'path#hash',
      'path$dollar',
      'path!bang',
      'パス',
    ])('rejects "%s"', (path) => {
      expect(() => validateStoragePath(path)).toThrow(PathValidationError);
    });
  });

  describe('protocol-relative paths', () => {
    it('rejects "//" prefix', () => {
      expect(() => validateStoragePath('//evil.com/path')).toThrow(PathValidationError);
    });
  });

  describe('excessive depth', () => {
    it('rejects paths deeper than 50 levels', () => {
      const deepPath = Array(51).fill('a').join('/');
      expect(() => validateStoragePath(deepPath)).toThrow(PathValidationError);
    });

    it('accepts paths at exactly 50 levels', () => {
      const deepPath = Array(50).fill('a').join('/');
      expect(() => validateStoragePath(deepPath)).not.toThrow();
    });
  });
});
