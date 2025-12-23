/**
 * S3 List Files ツール - ユーザーストレージのファイル一覧を取得
 */

import { tool } from '@strands-agents/sdk';
import { z } from 'zod';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
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
 * ファイルサイズを人間が読みやすい形式に変換
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * 日付を相対的な表現に変換
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}日前`;
  if (hours > 0) return `${hours}時間前`;
  if (minutes > 0) return `${minutes}分前`;
  return `${seconds}秒前`;
}

/**
 * S3 List Files ツール
 */
export const s3ListFilesTool = tool({
  name: 's3_list_files',
  description:
    'ユーザーのS3ストレージ内のファイルとディレクトリの一覧を取得します。指定されたパス配下のコンテンツを探索できます。',
  inputSchema: z.object({
    path: z
      .string()
      .default('/')
      .describe('一覧を取得するディレクトリパス（デフォルト: ルート "/"）'),
    recursive: z
      .boolean()
      .default(false)
      .describe('再帰的にサブディレクトリも含めて取得するか（デフォルト: false）'),
    maxResults: z
      .number()
      .min(1)
      .max(1000)
      .default(100)
      .describe('取得する最大結果数（1-1000、デフォルト: 100）'),
  }),
  callback: async (input) => {
    const { path, recursive, maxResults } = input;

    // リクエストコンテキストからユーザーIDを取得
    const context = getCurrentContext();
    if (!context?.userId) {
      logger.error('❌ S3リスト取得失敗: ユーザーIDが取得できません');
      return '❌ エラー: ユーザー認証情報が見つかりません。再度ログインしてください。';
    }

    const userId = context.userId;
    const bucketName = process.env.USER_STORAGE_BUCKET_NAME;

    if (!bucketName) {
      logger.error('❌ S3リスト取得失敗: バケット名が設定されていません');
      return '❌ エラー: ストレージ設定が不完全です（USER_STORAGE_BUCKET_NAME未設定）';
    }

    const normalizedPath = normalizePath(path);
    const prefix = normalizedPath
      ? `${getUserStoragePrefix(userId)}/${normalizedPath}/`
      : `${getUserStoragePrefix(userId)}/`;

    logger.info(`📁 S3ファイル一覧取得: user=${userId}, path=${path}, recursive=${recursive}`);

    try {
      const items: Array<{
        name: string;
        path: string;
        type: 'file' | 'directory';
        size?: number;
        lastModified?: Date;
      }> = [];

      if (recursive) {
        // 再帰的取得
        let continuationToken: string | undefined;
        let totalFetched = 0;

        do {
          const command = new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: prefix,
            MaxKeys: Math.min(1000, maxResults - totalFetched),
            ContinuationToken: continuationToken,
          });

          const response = await s3Client.send(command);

          if (response.Contents) {
            for (const content of response.Contents) {
              if (content.Key && content.Key !== prefix) {
                const relativePath = content.Key.replace(prefix, '');
                items.push({
                  name: relativePath.split('/').pop() || relativePath,
                  path: `/${normalizedPath}/${relativePath}`.replace(/\/+/g, '/'),
                  type: content.Key.endsWith('/') ? 'directory' : 'file',
                  size: content.Size,
                  lastModified: content.LastModified,
                });
                totalFetched++;

                if (totalFetched >= maxResults) break;
              }
            }
          }

          continuationToken = response.NextContinuationToken;

          if (totalFetched >= maxResults) break;
        } while (continuationToken);
      } else {
        // 非再帰的取得（現在のディレクトリのみ）
        const command = new ListObjectsV2Command({
          Bucket: bucketName,
          Prefix: prefix,
          Delimiter: '/',
          MaxKeys: maxResults,
        });

        const response = await s3Client.send(command);

        // ディレクトリを追加
        if (response.CommonPrefixes) {
          for (const commonPrefix of response.CommonPrefixes) {
            if (commonPrefix.Prefix) {
              const name = commonPrefix.Prefix.replace(prefix, '').replace(/\/$/, '');
              items.push({
                name,
                path: `/${normalizedPath}/${name}`.replace(/\/+/g, '/'),
                type: 'directory',
              });
            }
          }
        }

        // ファイルを追加
        if (response.Contents) {
          for (const content of response.Contents) {
            if (content.Key && content.Key !== prefix) {
              const name = content.Key.replace(prefix, '');
              items.push({
                name,
                path: `/${normalizedPath}/${name}`.replace(/\/+/g, '/'),
                type: 'file',
                size: content.Size,
                lastModified: content.LastModified,
              });
            }
          }
        }
      }

      // 結果のフォーマット
      if (items.length === 0) {
        return `📁 ディレクトリは空です\nパス: ${path}\n\nファイルやディレクトリが見つかりませんでした。`;
      }

      let output = `📁 S3ストレージ - ファイル一覧\n`;
      output += `パス: ${path}\n`;
      output += `モード: ${recursive ? '再帰的' : '現在のディレクトリのみ'}\n`;
      output += `合計: ${items.length}件\n\n`;

      // ディレクトリとファイルを分けてソート
      const directories = items.filter((item) => item.type === 'directory');
      const files = items.filter((item) => item.type === 'file');

      // ディレクトリ一覧
      if (directories.length > 0) {
        output += `📂 ディレクトリ (${directories.length}件):\n`;
        directories.forEach((dir) => {
          output += `  └─ 📁 ${dir.name}/\n`;
          output += `     パス: ${dir.path}\n`;
        });
        output += `\n`;
      }

      // ファイル一覧
      if (files.length > 0) {
        output += `📄 ファイル (${files.length}件):\n`;
        files.forEach((file) => {
          output += `  └─ 📄 ${file.name}\n`;
          output += `     パス: ${file.path}\n`;
          if (file.size !== undefined) {
            output += `     サイズ: ${formatFileSize(file.size)}\n`;
          }
          if (file.lastModified) {
            output += `     更新: ${formatRelativeTime(file.lastModified)} (${file.lastModified.toLocaleString('ja-JP')})\n`;
          }
        });
      }

      logger.info(
        `✅ S3ファイル一覧取得完了: ${items.length}件 (ディレクトリ: ${directories.length}, ファイル: ${files.length})`
      );

      return output.trim();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`❌ S3ファイル一覧取得エラー: ${errorMessage}`);

      return `❌ ファイル一覧の取得中にエラーが発生しました
パス: ${path}
エラー: ${errorMessage}

考えられる原因:
1. 指定されたパスが存在しない
2. S3バケットへのアクセス権限がない
3. ネットワーク接続の問題
4. AWS認証情報の問題`;
    }
  },
});
