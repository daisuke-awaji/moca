/**
 * Comprehensive unit tests for document-reader tool
 */

import { describe, it, expect, beforeAll, jest, afterEach } from '@jest/globals';
import { readFileSync, existsSync, writeFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseOffice } from 'officeparser';
import * as XLSX from 'xlsx';

import { EXTENSION_FORMAT_MAP, MAX_FILE_SIZE } from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURES_DIR = join(__dirname, 'fixtures');

// ============================================================
// Helper: import and invoke the tool callback directly
// We mock the dependencies that require runtime context
// ============================================================

// Mock request-context to avoid runtime dependency
jest.unstable_mockModule('../../../context/request-context.js', () => ({
  getCurrentContext: jest.fn(() => undefined),
  getCurrentStoragePath: jest.fn(() => '/'),
}));

// Dynamic import after mock setup
const { documentReaderTool } = await import('../tool.js');

/**
 * Helper to invoke the tool callback directly
 */
async function invokeTool(input: { filePath: string; maxLength?: number }): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toolAny = documentReaderTool as any;
  return toolAny._callback(input);
}

// ============================================================
// 1. Library behavior tests - officeparser
// ============================================================
describe('Library: officeparser', () => {
  describe('DOCX parsing', () => {
    it('should extract basic Japanese text from DOCX', async () => {
      const buffer = readFileSync(join(FIXTURES_DIR, 'test.docx'));
      const ast = await parseOffice(buffer);
      const text = ast.toText();

      expect(text).toContain('テストドキュメント');
      expect(text).toContain('セクション1');
      expect(text).toContain('日本語テキスト');
      expect(text).toContain('12345');
      expect(text.length).toBeGreaterThan(0);
    });

    it('should extract text from DOCX with tables, lists, and special characters', async () => {
      const buffer = readFileSync(join(FIXTURES_DIR, 'complex.docx'));
      const ast = await parseOffice(buffer);
      const text = ast.toText();

      expect(text).toContain('複合ドキュメントテスト');
      expect(text).toContain('通常のパラグラフ');
      // Table content
      expect(text).toContain('売上');
      expect(text).toContain('1,000,000');
      expect(text).toContain('利益');
      expect(text).toContain('250,000');
      // List items
      expect(text).toContain('アイテム1');
      expect(text).toContain('アイテム2');
      expect(text).toContain('アイテム3');
      // Special characters
      expect(text).toContain('特殊文字');
    });

    it('should return AST with type "docx"', async () => {
      const buffer = readFileSync(join(FIXTURES_DIR, 'test.docx'));
      const ast = await parseOffice(buffer);
      expect(ast.type).toBe('docx');
    });

    it('should return empty or minimal text for empty-content DOCX', async () => {
      const buffer = readFileSync(join(FIXTURES_DIR, 'empty-content.docx'));
      const ast = await parseOffice(buffer);
      const text = ast.toText();
      expect(text.trim().length).toBe(0);
    });

    it('should throw error for corrupt DOCX', async () => {
      const buffer = readFileSync(join(FIXTURES_DIR, 'corrupt.docx'));
      await expect(parseOffice(buffer)).rejects.toThrow();
    });
  });

  describe('PPTX parsing', () => {
    it('should extract basic text from PPTX', async () => {
      const buffer = readFileSync(join(FIXTURES_DIR, 'test.pptx'));
      const ast = await parseOffice(buffer);
      const text = ast.toText();

      expect(text).toContain('テストプレゼンテーション');
      expect(text).toContain('サブタイトル');
      expect(text).toContain('スライド2');
      expect(text.length).toBeGreaterThan(0);
    });

    it('should extract text from multi-slide PPTX', async () => {
      const buffer = readFileSync(join(FIXTURES_DIR, 'multi-slide.pptx'));
      const ast = await parseOffice(buffer);
      const text = ast.toText();

      expect(text).toContain('四半期報告書');
      expect(text).toContain('2026年Q1');
      expect(text).toContain('業績サマリー');
      expect(text).toContain('100億円');
      expect(text).toContain('今後の展望');
      expect(text).toContain('AI活用の推進');
      expect(text).toContain('テキストボックスの内容');
    });

    it('should return AST with type "pptx"', async () => {
      const buffer = readFileSync(join(FIXTURES_DIR, 'test.pptx'));
      const ast = await parseOffice(buffer);
      expect(ast.type).toBe('pptx');
    });

    it('should throw error for corrupt PPTX', async () => {
      const buffer = readFileSync(join(FIXTURES_DIR, 'corrupt.pptx'));
      await expect(parseOffice(buffer)).rejects.toThrow();
    });
  });

  describe('PDF parsing', () => {
    it('should extract basic text from PDF', async () => {
      const buffer = readFileSync(join(FIXTURES_DIR, 'test.pdf'));
      const ast = await parseOffice(buffer);
      const text = ast.toText();

      expect(text).toContain('Test PDF Document');
      expect(text).toContain('Page 1 of the document');
      expect(text).toContain('Page 2 content');
      expect(text.length).toBeGreaterThan(0);
    });

    it('should extract text from multi-page PDF', async () => {
      const buffer = readFileSync(join(FIXTURES_DIR, 'japanese.pdf'));
      const ast = await parseOffice(buffer);
      const text = ast.toText();

      expect(text).toContain('Japanese Document Test');
      expect(text).toContain('Section 1: Overview');
      expect(text).toContain('Section 2: Details');
      expect(text).toContain('Section 3: Conclusion');
    });

    it('should return AST with type "pdf"', async () => {
      const buffer = readFileSync(join(FIXTURES_DIR, 'test.pdf'));
      const ast = await parseOffice(buffer);
      expect(ast.type).toBe('pdf');
    });

    it('should throw error for corrupt PDF', async () => {
      const buffer = readFileSync(join(FIXTURES_DIR, 'corrupt.pdf'));
      await expect(parseOffice(buffer)).rejects.toThrow();
    });
  });
});

// ============================================================
// 2. Library behavior tests - SheetJS (xlsx)
// ============================================================
describe('Library: SheetJS (xlsx)', () => {
  it('should extract all cell data including headers and string cells', () => {
    const buffer = readFileSync(join(FIXTURES_DIR, 'test.xlsx'));
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    expect(workbook.SheetNames).toContain('Sheet1');
    const csv = XLSX.utils.sheet_to_csv(workbook.Sheets['Sheet1']);

    expect(csv).toContain('名前');
    expect(csv).toContain('年齢');
    expect(csv).toContain('部署');
    expect(csv).toContain('田中太郎');
    expect(csv).toContain('30');
    expect(csv).toContain('開発部');
  });

  it('should handle multiple sheets', () => {
    const buffer = readFileSync(join(FIXTURES_DIR, 'multi-sheet.xlsx'));
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    expect(workbook.SheetNames).toEqual(['売上データ', '空シート', '混合データ']);
  });

  it('should extract data from first sheet with headers', () => {
    const buffer = readFileSync(join(FIXTURES_DIR, 'multi-sheet.xlsx'));
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const csv = XLSX.utils.sheet_to_csv(workbook.Sheets['売上データ']);

    expect(csv).toContain('日付');
    expect(csv).toContain('商品');
    expect(csv).toContain('商品A');
    expect(csv).toContain('2026-01-01');
    expect(csv).toContain('10000');
  });

  it('should handle empty sheet', () => {
    const buffer = readFileSync(join(FIXTURES_DIR, 'multi-sheet.xlsx'));
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const csv = XLSX.utils.sheet_to_csv(workbook.Sheets['空シート']);

    expect(csv.trim()).toBe('');
  });

  it('should handle mixed data types', () => {
    const buffer = readFileSync(join(FIXTURES_DIR, 'multi-sheet.xlsx'));
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const csv = XLSX.utils.sheet_to_csv(workbook.Sheets['混合データ']);

    expect(csv).toContain('文字列');
    expect(csv).toContain('整数');
    expect(csv).toContain('小数');
    expect(csv).toContain('Hello');
    expect(csv).toContain('42');
    expect(csv).toContain('3.14');
    expect(csv).toContain('TRUE');
    expect(csv).toContain('FALSE');
  });

  it('should produce structured text with sheet name headers', () => {
    const buffer = readFileSync(join(FIXTURES_DIR, 'multi-sheet.xlsx'));
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    const parts: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      parts.push(`## ${sheetName}`);
      parts.push(XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]));
    }
    const result = parts.join('\n');

    expect(result).toContain('## 売上データ');
    expect(result).toContain('## 空シート');
    expect(result).toContain('## 混合データ');
  });

  it('should handle corrupt XLSX gracefully (SheetJS parses as text)', () => {
    const buffer = readFileSync(join(FIXTURES_DIR, 'corrupt.xlsx'));
    // SheetJS does not throw for invalid data; it interprets bytes as text
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    expect(workbook.SheetNames.length).toBeGreaterThan(0);
  });
});

// ============================================================
// 3. Format detection (types.ts)
// ============================================================
describe('Format detection', () => {
  it('should map .pdf to pdf', () => {
    expect(EXTENSION_FORMAT_MAP['.pdf']).toBe('pdf');
  });

  it('should map .docx to docx', () => {
    expect(EXTENSION_FORMAT_MAP['.docx']).toBe('docx');
  });

  it('should map .pptx to pptx', () => {
    expect(EXTENSION_FORMAT_MAP['.pptx']).toBe('pptx');
  });

  it('should map .xlsx to xlsx', () => {
    expect(EXTENSION_FORMAT_MAP['.xlsx']).toBe('xlsx');
  });

  it('should return undefined for .txt', () => {
    expect(EXTENSION_FORMAT_MAP['.txt']).toBeUndefined();
  });

  it('should return undefined for .doc (legacy Word)', () => {
    expect(EXTENSION_FORMAT_MAP['.doc']).toBeUndefined();
  });

  it('should return undefined for .xls (legacy Excel)', () => {
    expect(EXTENSION_FORMAT_MAP['.xls']).toBeUndefined();
  });

  it('should return undefined for .csv', () => {
    expect(EXTENSION_FORMAT_MAP['.csv']).toBeUndefined();
  });

  it('should return undefined for .ppt (legacy PowerPoint)', () => {
    expect(EXTENSION_FORMAT_MAP['.ppt']).toBeUndefined();
  });

  it('should define MAX_FILE_SIZE as 50MB', () => {
    expect(MAX_FILE_SIZE).toBe(50 * 1024 * 1024);
  });
});

// ============================================================
// 4. Tool callback integration tests
// ============================================================
describe('documentReaderTool callback', () => {
  describe('input validation', () => {
    it('should reject unsupported file format (.txt)', async () => {
      const tmpFile = join(FIXTURES_DIR, 'temp.txt');
      writeFileSync(tmpFile, 'hello');
      try {
        const result = await invokeTool({ filePath: tmpFile });
        expect(result).toContain('Unsupported file format');
        expect(result).toContain('.pdf');
        expect(result).toContain('.docx');
      } finally {
        unlinkSync(tmpFile);
      }
    });

    it('should reject unsupported file format (.csv)', async () => {
      const tmpFile = join(FIXTURES_DIR, 'temp.csv');
      writeFileSync(tmpFile, 'a,b,c');
      try {
        const result = await invokeTool({ filePath: tmpFile });
        expect(result).toContain('Unsupported file format');
      } finally {
        unlinkSync(tmpFile);
      }
    });

    it('should reject file without extension', async () => {
      const tmpFile = join(FIXTURES_DIR, 'noextension');
      writeFileSync(tmpFile, 'data');
      try {
        const result = await invokeTool({ filePath: tmpFile });
        expect(result).toContain('Unsupported file format');
      } finally {
        unlinkSync(tmpFile);
      }
    });

    it('should handle uppercase extensions (.PDF) via case-insensitive detection', async () => {
      // The tool uses extname().toLowerCase(), so .PDF file path should work
      // We create a file with .PDF extension
      const tmpFile = join(FIXTURES_DIR, 'test_upper.PDF');
      const srcBuffer = readFileSync(join(FIXTURES_DIR, 'test.pdf'));
      writeFileSync(tmpFile, srcBuffer);
      try {
        const result = await invokeTool({ filePath: tmpFile });
        expect(result).toContain('Document read successfully');
        expect(result).toContain('Format: PDF');
      } finally {
        unlinkSync(tmpFile);
      }
    });

    it('should handle mixed-case extensions (.Docx)', async () => {
      const tmpFile = join(FIXTURES_DIR, 'test_mixed.Docx');
      const srcBuffer = readFileSync(join(FIXTURES_DIR, 'test.docx'));
      writeFileSync(tmpFile, srcBuffer);
      try {
        const result = await invokeTool({ filePath: tmpFile });
        expect(result).toContain('Document read successfully');
        expect(result).toContain('Format: DOCX');
      } finally {
        unlinkSync(tmpFile);
      }
    });
  });

  describe('file system checks', () => {
    it('should return error for non-existent file', async () => {
      const result = await invokeTool({ filePath: '/tmp/ws/does_not_exist.pdf' });
      expect(result).toContain('File not found');
      expect(result).toContain('does_not_exist.pdf');
    });

    it('should return error for non-existent deep path', async () => {
      const result = await invokeTool({ filePath: '/tmp/ws/a/b/c/d/report.docx' });
      expect(result).toContain('File not found');
    });

    it('should return error for zero-byte file', async () => {
      const result = await invokeTool({ filePath: join(FIXTURES_DIR, 'zero-byte.docx') });
      expect(result).toContain('File is empty');
    });
  });

  describe('successful extraction - DOCX', () => {
    it('should extract text from basic DOCX and return formatted response', async () => {
      const result = await invokeTool({ filePath: join(FIXTURES_DIR, 'test.docx') });

      expect(result).toContain('Document read successfully');
      expect(result).toContain('File: test.docx');
      expect(result).toContain('Format: DOCX');
      expect(result).toContain('Size:');
      expect(result).toContain('Extracted:');
      expect(result).toContain('---');
      expect(result).toContain('テストドキュメント');
      expect(result).toContain('日本語テキスト');
    });

    it('should extract text from complex DOCX with tables and lists', async () => {
      const result = await invokeTool({ filePath: join(FIXTURES_DIR, 'complex.docx') });

      expect(result).toContain('Document read successfully');
      expect(result).toContain('複合ドキュメントテスト');
      expect(result).toContain('売上');
      expect(result).toContain('アイテム1');
    });
  });

  describe('successful extraction - PPTX', () => {
    it('should extract text from basic PPTX and return formatted response', async () => {
      const result = await invokeTool({ filePath: join(FIXTURES_DIR, 'test.pptx') });

      expect(result).toContain('Document read successfully');
      expect(result).toContain('File: test.pptx');
      expect(result).toContain('Format: PPTX');
      expect(result).toContain('テストプレゼンテーション');
    });

    it('should extract text from multi-slide PPTX', async () => {
      const result = await invokeTool({ filePath: join(FIXTURES_DIR, 'multi-slide.pptx') });

      expect(result).toContain('Document read successfully');
      expect(result).toContain('四半期報告書');
      expect(result).toContain('業績サマリー');
      expect(result).toContain('テキストボックスの内容');
    });
  });

  describe('successful extraction - XLSX', () => {
    it('should extract text from basic XLSX and return formatted response', async () => {
      const result = await invokeTool({ filePath: join(FIXTURES_DIR, 'test.xlsx') });

      expect(result).toContain('Document read successfully');
      expect(result).toContain('File: test.xlsx');
      expect(result).toContain('Format: XLSX');
      expect(result).toContain('名前');
      expect(result).toContain('田中太郎');
      expect(result).toContain('開発部');
    });

    it('should extract text from multi-sheet XLSX with sheet names', async () => {
      const result = await invokeTool({ filePath: join(FIXTURES_DIR, 'multi-sheet.xlsx') });

      expect(result).toContain('Document read successfully');
      expect(result).toContain('## 売上データ');
      expect(result).toContain('## 空シート');
      expect(result).toContain('## 混合データ');
      expect(result).toContain('商品A');
      expect(result).toContain('Hello');
    });
  });

  describe('successful extraction - PDF', () => {
    it('should extract text from basic PDF and return formatted response', async () => {
      const result = await invokeTool({ filePath: join(FIXTURES_DIR, 'test.pdf') });

      expect(result).toContain('Document read successfully');
      expect(result).toContain('File: test.pdf');
      expect(result).toContain('Format: PDF');
      expect(result).toContain('Test PDF Document');
    });

    it('should extract text from multi-page PDF', async () => {
      const result = await invokeTool({ filePath: join(FIXTURES_DIR, 'japanese.pdf') });

      expect(result).toContain('Document read successfully');
      expect(result).toContain('Section 1: Overview');
      expect(result).toContain('Section 2: Details');
      expect(result).toContain('Section 3: Conclusion');
    });
  });

  describe('response format', () => {
    it('should include all required header fields', async () => {
      const result = await invokeTool({ filePath: join(FIXTURES_DIR, 'test.docx') });
      const lines = result.split('\n');

      expect(lines[0]).toBe('Document read successfully');
      expect(lines.some((l: string) => l.startsWith('File:'))).toBe(true);
      expect(lines.some((l: string) => l.startsWith('Format:'))).toBe(true);
      expect(lines.some((l: string) => l.startsWith('Size:'))).toBe(true);
      expect(lines.some((l: string) => l.startsWith('Extracted:'))).toBe(true);
    });

    it('should separate header from content with ---', async () => {
      const result = await invokeTool({ filePath: join(FIXTURES_DIR, 'test.docx') });
      expect(result).toContain('---');

      const parts = result.split('---');
      expect(parts.length).toBeGreaterThanOrEqual(2);
      // Header part should contain metadata
      expect(parts[0]).toContain('Document read successfully');
      // Content part should contain actual text
      expect(parts[1]).toContain('テストドキュメント');
    });

    it('should show character count in Extracted field', async () => {
      const result = await invokeTool({ filePath: join(FIXTURES_DIR, 'test.docx') });
      const extractedLine = result.split('\n').find((l: string) => l.startsWith('Extracted:'));
      expect(extractedLine).toBeDefined();
      expect(extractedLine).toMatch(/Extracted: \d+ characters/);
    });
  });

  describe('text truncation', () => {
    it('should truncate when text exceeds maxLength', async () => {
      // test.docx has ~99 chars, set maxLength to 20
      const result = await invokeTool({ filePath: join(FIXTURES_DIR, 'test.docx'), maxLength: 20 });

      expect(result).toContain('truncated to 20');
      expect(result).toContain('⚠️ Text was truncated');
      expect(result).toContain('characters omitted');
      expect(result).toContain('Increase maxLength');
    });

    it('should not truncate when text is within maxLength', async () => {
      const result = await invokeTool({ filePath: join(FIXTURES_DIR, 'test.docx'), maxLength: 200000 });

      expect(result).not.toContain('truncated');
      expect(result).not.toContain('⚠️');
    });

    it('should respect custom maxLength value', async () => {
      const result50 = await invokeTool({ filePath: join(FIXTURES_DIR, 'test.docx'), maxLength: 50 });
      const result10 = await invokeTool({ filePath: join(FIXTURES_DIR, 'test.docx'), maxLength: 10 });

      // Both should be truncated but result10 should have more omitted characters
      expect(result50).toContain('truncated to 50');
      expect(result10).toContain('truncated to 10');
    });

    it('should use default maxLength of 50000 when not specified', async () => {
      // The test.docx is small (~99 chars) so it won't be truncated at default
      const result = await invokeTool({ filePath: join(FIXTURES_DIR, 'test.docx') });
      expect(result).not.toContain('truncated');
    });
  });

  describe('error handling - parse failures', () => {
    it('should return parse error for corrupt DOCX', async () => {
      const result = await invokeTool({ filePath: join(FIXTURES_DIR, 'corrupt.docx') });
      expect(result).toContain('Failed to parse document');
    });

    it('should return PDF-specific guidance for corrupt PDF', async () => {
      const result = await invokeTool({ filePath: join(FIXTURES_DIR, 'corrupt.pdf') });
      expect(result).toContain('image_to_text');
    });

    it('should handle corrupt XLSX gracefully (SheetJS parses as text)', async () => {
      const result = await invokeTool({ filePath: join(FIXTURES_DIR, 'corrupt.xlsx') });
      // SheetJS does not throw for invalid data, so the tool returns extracted content
      expect(result).toContain('Document read successfully');
    });

    it('should return parse error for corrupt PPTX', async () => {
      const result = await invokeTool({ filePath: join(FIXTURES_DIR, 'corrupt.pptx') });
      expect(result).toContain('Failed to parse document');
    });

    it('should return empty-content guidance for DOCX with no text', async () => {
      const result = await invokeTool({ filePath: join(FIXTURES_DIR, 'empty-content.docx') });
      expect(result).toContain('No text content found');
    });
  });
});
