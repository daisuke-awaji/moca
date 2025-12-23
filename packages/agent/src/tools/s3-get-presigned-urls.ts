/**
 * S3 Get Presigned URLs ツール - 署名付きURLの一括取得
 */

import { tool } from '@strands-agents/sdk';
import { z } from 'zod';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getCurrentContext } from '../context/request-context.js';
import { logger } from '../config/index.js';

const s3Client = new S3Client({ region: process.env.AWS_REGION });

/**
 * ユーザーのストレージパスプレフィックスを生成
 */
function getUserStoragePrefix(userId: string): string {
  return `users/${userId}`;
}

/**
 * パスを正規化（先頭・末尾のスラッシュを削除）
 */
function normalizePath(path: string): string {
  return path.replace(/^\/+|\/+$/g, '');
}

/**
 * S3 Get Presigned URLs ツール
 */
export const s3GetPresignedUrlsTool = tool({
  name: 's3_get_presigned_urls',
  description:
    'ユーザーのS3ストレージ内のファイルに対する署名付きURLを一括で生成します。ダウンロード用またはアップロード用のURLを取得できます。複数のファイルを一度に処理できます。',
  inputSchema: z.object({
    paths: z
      .union([z.string(), z.array(z.string())])
      .describe('ファイルパス（単一の文字列または文字列の配列）'),
    operation: z
      .enum(['download', 'upload'])
      .default('download')
      .describe('操作タイプ: "download"（ダウンロード用）または "upload"（アップロード用）'),
    expiresIn: z
      .number()
      .min(60)
      .max(604800)
      .default(3600)
      .describe('署名付きURLの有効期限（秒）。デフォルト: 3600（1時間）、最大: 604800（7日間）'),
    contentType: z
      .string()
      .optional()
      .describe('アップロード操作の場合のContent-Type（オプション）'),
  }),
  callback: async (input) => {
    const { paths, operation, expiresIn, contentType } = input;

    // リクエストコンテキストからユーザーIDを取得
    const context = getCurrentContext();
    if (!context?.userId) {
      logger.error('❌ S3 Presigned URL取得失敗: ユーザーIDが取得できません');
      return '❌ エラー: ユーザー認証情報が見つかりません。再度ログインしてください。';
    }

    const userId = context.userId;
    const bucketName = process.env.USER_STORAGE_BUCKET_NAME;

    if (!bucketName) {
      logger.error('❌ S3 Presigned URL取得失敗: バケット名が設定されていません');
      return '❌ エラー: ストレージ設定が不完全です（USER_STORAGE_BUCKET_NAME未設定）';
    }

    // パスを配列に正規化
    const pathsArray = Array.isArray(paths) ? paths : [paths];

    if (pathsArray.length === 0) {
      return '❌ エラー: 少なくとも1つのファイルパスを指定してください。';
    }

    logger.info(
      `🔗 S3 Presigned URL生成開始: user=${userId}, operation=${operation}, count=${pathsArray.length}, expiresIn=${expiresIn}s`
    );

    try {
      const results: Array<{
        path: string;
        url: string;
        expiresAt: string;
        operation: string;
      }> = [];

      const errors: Array<{
        path: string;
        error: string;
      }> = [];

      for (const path of pathsArray) {
        try {
          const normalizedPath = normalizePath(path);
          const key = `${getUserStoragePrefix(userId)}/${normalizedPath}`;

          let url: string;

          if (operation === 'download') {
            // ダウンロード用署名付きURL
            const command = new GetObjectCommand({
              Bucket: bucketName,
              Key: key,
            });

            url = await getSignedUrl(s3Client, command, { expiresIn });
          } else {
            // アップロード用署名付きURL
            const command = new PutObjectCommand({
              Bucket: bucketName,
              Key: key,
              ContentType: contentType || 'application/octet-stream',
            });

            url = await getSignedUrl(s3Client, command, { expiresIn });
          }

          const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

          results.push({
            path,
            url,
            expiresAt,
            operation,
          });

          logger.info(`✅ Presigned URL生成成功: ${path} (${operation})`);
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.error(`❌ Presigned URL生成エラー: ${path} - ${errorMessage}`);

          errors.push({
            path,
            error: errorMessage,
          });
        }
      }

      // 結果のフォーマット
      let output = `🔗 S3 Presigned URLs 生成結果\n\n`;
      output += `操作: ${operation === 'download' ? 'ダウンロード' : 'アップロード'}\n`;
      output += `有効期限: ${expiresIn}秒（${Math.floor(expiresIn / 60)}分）\n`;
      output += `成功: ${results.length}件 / 失敗: ${errors.length}件\n\n`;

      if (results.length > 0) {
        output += `✅ 成功したファイル:\n\n`;
        results.forEach((result, index) => {
          output += `${index + 1}. ${result.path}\n`;
          output += `   URL: ${result.url}\n`;
          output += `   有効期限: ${new Date(result.expiresAt).toLocaleString('ja-JP')}\n\n`;
        });
      }

      if (errors.length > 0) {
        output += `\n❌ 失敗したファイル:\n\n`;
        errors.forEach((error, index) => {
          output += `${index + 1}. ${error.path}\n`;
          output += `   エラー: ${error.error}\n\n`;
        });
      }

      logger.info(`✅ Presigned URL生成完了: 成功 ${results.length}件, 失敗 ${errors.length}件`);

      return output.trim();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`❌ S3 Presigned URL生成エラー: ${errorMessage}`);

      return `❌ 署名付きURLの生成中にエラーが発生しました
エラー: ${errorMessage}

考えられる原因:
1. S3バケットへのアクセス権限がない
2. ネットワーク接続の問題
3. AWS認証情報の問題
4. 指定されたパスが不正`;
    }
  },
});
