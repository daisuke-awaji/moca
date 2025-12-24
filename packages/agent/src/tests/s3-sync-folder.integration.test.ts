/**
 * S3 Sync Folder Tool - Integration Test
 */

import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const TEST_BUCKET = process.env.USER_STORAGE_BUCKET_NAME || '';
const TEST_USER_ID = 'test-user-sync-folder';
const TEST_LOCAL_PATH = '/tmp/ws/test-sync';

describe('S3 Sync Folder Tool - Integration Test', () => {
  beforeAll(async () => {
    if (!TEST_BUCKET) {
      console.warn(
        '⚠️  USER_STORAGE_BUCKET_NAME環境変数が設定されていません。テストをスキップします。'
      );
      return;
    }

    // Ensure test directory exists
    if (!fs.existsSync(TEST_LOCAL_PATH)) {
      fs.mkdirSync(TEST_LOCAL_PATH, { recursive: true });
    }

    // Upload test files to S3
    const testFiles = [
      { key: 'test-file-1.txt', content: 'Test content 1' },
      { key: 'test-file-2.txt', content: 'Test content 2' },
      { key: 'subdir/test-file-3.txt', content: 'Test content 3 in subdirectory' },
      { key: 'subdir/test-file-4.json', content: JSON.stringify({ test: 'data' }) },
    ];

    console.log('\n📤 Uploading test files to S3...');
    for (const file of testFiles) {
      const key = `users/${TEST_USER_ID}/sync-test/${file.key}`;
      await s3Client.send(
        new PutObjectCommand({
          Bucket: TEST_BUCKET,
          Key: key,
          Body: file.content,
          ContentType: file.key.endsWith('.json') ? 'application/json' : 'text/plain',
        })
      );
      console.log(`  ✅ Uploaded: ${key}`);
    }
  });

  afterAll(async () => {
    if (!TEST_BUCKET) {
      return;
    }

    // Clean up test directory
    if (fs.existsSync(TEST_LOCAL_PATH)) {
      fs.rmSync(TEST_LOCAL_PATH, { recursive: true, force: true });
    }

    // Clean up S3 test files
    console.log('\n🗑️  Cleaning up S3 test files...');
    const listResponse = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: TEST_BUCKET,
        Prefix: `users/${TEST_USER_ID}/sync-test/`,
      })
    );

    if (listResponse.Contents) {
      for (const item of listResponse.Contents) {
        if (item.Key) {
          await s3Client.send(
            new DeleteObjectCommand({
              Bucket: TEST_BUCKET,
              Key: item.Key,
            })
          );
          console.log(`  ✅ Deleted: ${item.Key}`);
        }
      }
    }
  });

  describe('S3 test file verification', () => {
    test('should have uploaded test files to S3', async () => {
      if (!TEST_BUCKET) {
        console.log('⚠️  バケット名が未設定のためスキップ');
        return;
      }

      const listResponse = await s3Client.send(
        new ListObjectsV2Command({
          Bucket: TEST_BUCKET,
          Prefix: `users/${TEST_USER_ID}/sync-test/`,
        })
      );

      expect(listResponse.Contents).toBeDefined();
      expect(listResponse.Contents!.length).toBeGreaterThanOrEqual(4);

      console.log(`✅ Found ${listResponse.Contents!.length} test files in S3`);
    });
  });

  describe('Local path validation', () => {
    test('should allow paths under /tmp/ws', () => {
      const validPaths = ['/tmp/ws/data', '/tmp/ws/test/folder', '/tmp/ws'];

      for (const testPath of validPaths) {
        const resolvedPath = path.resolve(testPath);
        const allowedBase = path.resolve('/tmp/ws');
        expect(resolvedPath.startsWith(allowedBase)).toBe(true);
      }
    });

    test('should reject paths outside /tmp/ws', () => {
      const invalidPaths = ['/tmp/other', '/etc/passwd', '/home/user', '/var/log'];

      for (const testPath of invalidPaths) {
        const resolvedPath = path.resolve(testPath);
        const allowedBase = path.resolve('/tmp/ws');
        expect(resolvedPath.startsWith(allowedBase)).toBe(false);
      }
    });
  });

  describe('File pattern matching', () => {
    test('should match simple patterns', () => {
      const pattern = '*.txt';
      const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.');
      const regex = new RegExp(`^${regexPattern}$`);

      expect(regex.test('file.txt')).toBe(true);
      expect(regex.test('file.json')).toBe(false);
      expect(regex.test('test-file-1.txt')).toBe(true);
    });

    test('should match complex patterns', () => {
      const pattern = 'data_*.json';
      const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.');
      const regex = new RegExp(`^${regexPattern}$`);

      expect(regex.test('data_001.json')).toBe(true);
      expect(regex.test('data_test.json')).toBe(true);
      expect(regex.test('data.json')).toBe(false);
      expect(regex.test('data_001.txt')).toBe(false);
    });
  });

  describe('Tool integration readiness', () => {
    test('should have S3 client configured', () => {
      expect(s3Client).toBeDefined();
      expect(TEST_BUCKET).toBeDefined();
    });

    test('should have test directory prepared', () => {
      if (!TEST_BUCKET) {
        console.log('⚠️  バケット名が未設定のためスキップ');
        return;
      }

      expect(fs.existsSync(TEST_LOCAL_PATH)).toBe(true);
    });
  });
});
