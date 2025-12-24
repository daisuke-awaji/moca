/**
 * 日本語ファイル名のS3ダウンロード インテグレーションテスト
 */

import { S3Client, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { describe, test, expect, beforeAll } from '@jest/globals';

// テスト用の定数
const TEST_USER_ID = '04685458-c001-70d7-b25e-6d575ca4d2b6';
const TEST_PATH = 'work/売り上げデータ.csv';

/**
 * パスを正規化（先頭・末尾のスラッシュを削除）
 */
function normalizePath(path: string): string {
  return path.replace(/^\/+|\/+$/g, '');
}

/**
 * バイト列を16進数で表示
 */
function bytesToHex(str: string): string {
  return Buffer.from(str, 'utf-8').toString('hex').match(/.{2}/g)?.join(' ') || '';
}

describe('S3 Japanese Filename Integration Test', () => {
  let s3Client: S3Client;
  let bucketName: string;
  let region: string;
  let s3Key: string;

  beforeAll(() => {
    // 環境変数から設定を取得
    bucketName = process.env.USER_STORAGE_BUCKET_NAME || '';
    region = process.env.AWS_REGION || 'us-east-1';

    if (!bucketName) {
      console.warn(
        '⚠️  USER_STORAGE_BUCKET_NAME環境変数が設定されていません。テストをスキップします。'
      );
    }

    s3Client = new S3Client({ region });

    // S3キーを作成（NFD正規化）
    const normalizedPath = normalizePath(TEST_PATH).normalize('NFD');
    s3Key = `users/${TEST_USER_ID}/${normalizedPath}`;

    console.log('\n📝 テスト情報:');
    console.log(`  バケット: ${bucketName}`);
    console.log(`  リージョン: ${region}`);
    console.log(`  S3キー: "${s3Key}"`);
    console.log(`  バイト列（Hex）: ${bytesToHex(s3Key)}`);
  });

  describe('normalizePath utility', () => {
    test('should remove leading slashes', () => {
      expect(normalizePath('/test/path')).toBe('test/path');
      expect(normalizePath('//test/path')).toBe('test/path');
    });

    test('should remove trailing slashes', () => {
      expect(normalizePath('test/path/')).toBe('test/path');
      expect(normalizePath('test/path//')).toBe('test/path');
    });

    test('should remove both leading and trailing slashes', () => {
      expect(normalizePath('/test/path/')).toBe('test/path');
    });

    test('should handle Japanese characters', () => {
      expect(normalizePath('/売り上げデータ/')).toBe('売り上げデータ');
    });
  });

  describe('bytesToHex utility', () => {
    test('should convert ASCII string to hex', () => {
      const result = bytesToHex('abc');
      expect(result).toBe('61 62 63');
    });

    test('should convert Japanese characters to hex', () => {
      const result = bytesToHex('あ');
      expect(result).toMatch(/^[0-9a-f\s]+$/);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('S3 Operations with Japanese Filename', () => {
    test('should check file existence with HeadObject', async () => {
      if (!bucketName) {
        console.log('⚠️  バケット名が未設定のためスキップ');
        return;
      }

      const command = new HeadObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
      });

      const metadata = await s3Client.send(command);

      expect(metadata).toBeDefined();
      expect(metadata.ContentLength).toBeGreaterThan(0);
      expect(metadata.ContentType).toBeDefined();
      expect(metadata.LastModified).toBeInstanceOf(Date);

      console.log('✅ HeadObject成功:');
      console.log(`  サイズ: ${metadata.ContentLength} bytes`);
      console.log(`  Content-Type: ${metadata.ContentType}`);
    });

    test('should retrieve file content with GetObject', async () => {
      if (!bucketName) {
        console.log('⚠️  バケット名が未設定のためスキップ');
        return;
      }

      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
      });

      const response = await s3Client.send(command);

      expect(response.Body).toBeDefined();

      // ストリームをテキストに変換
      const bodyString = await response.Body!.transformToString('utf-8');

      expect(bodyString).toBeDefined();
      expect(bodyString.length).toBeGreaterThan(0);

      console.log('✅ GetObject成功:');
      console.log(`  内容の長さ: ${bodyString.length}文字`);

      // ファイル内容のプレビュー（最初の200文字）
      const preview = bodyString.length > 200 ? bodyString.substring(0, 200) + '...' : bodyString;
      console.log('📄 プレビュー:', preview);
    });

    test('should handle normalized paths correctly', async () => {
      if (!bucketName) {
        console.log('⚠️  バケット名が未設定のためスキップ');
        return;
      }

      // パスの正規化が正しく動作することを確認
      const normalizedPath = normalizePath(TEST_PATH).normalize('NFD');
      const testKey = `users/${TEST_USER_ID}/${normalizedPath}`;

      expect(testKey).toBe(s3Key);

      // 実際にS3にアクセスして確認
      const command = new HeadObjectCommand({
        Bucket: bucketName,
        Key: testKey,
      });

      await expect(s3Client.send(command)).resolves.toBeDefined();
    });
  });
});
