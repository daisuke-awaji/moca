/**
 * S3 Download File ツール - ファイルのダウンロード・読み取り
 */

import { tool } from '@strands-agents/sdk';
import { z } from 'zod';
import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getCurrentContext } from '../context/request-context.js';
import { logger } from '../config/index.js';

const s3Client = new S3Client({ region: process.env.AWS_REGION });

// Bedrock Converse API の制限を考慮したファイルサイズ上限
// Note: MAX_INLINE_SIZE (5MB) は参考値。実際のテキスト取得制限はMAX_TEXT_SIZEを使用
const MAX_TEXT_SIZE = 1 * 1024 * 1024; // 1MB (テキストファイルの実際の取得制限)

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
 * Content-Typeからテキストファイルかを判定
 */
function isTextFile(contentType: string): boolean {
  const textTypes = [
    'text/',
    'application/json',
    'application/xml',
    'application/javascript',
    'application/typescript',
    'application/x-yaml',
  ];
  return textTypes.some((type) => contentType.startsWith(type));
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
 * S3 Download File ツール
 */
export const s3DownloadFileTool = tool({
  name: 's3_download_file',
  description:
    'ユーザーのS3ストレージからファイルをダウンロードまたは読み取ります。テキストファイルの場合は内容を直接取得し、大きなファイルやバイナリファイルの場合は署名付きダウンロードURLを生成します。',
  inputSchema: z.object({
    path: z.string().describe('ダウンロード・読み取りするファイルのパス（必須）'),
    returnContent: z
      .boolean()
      .default(true)
      .describe(
        'テキストファイルの内容を直接返すか（デフォルト: true）。falseの場合は常に署名付きURLを返す'
      ),
    maxContentLength: z
      .number()
      .min(1024)
      .max(MAX_TEXT_SIZE)
      .default(500 * 1024)
      .describe('内容を取得する場合の最大サイズ（バイト）。デフォルト: 500KB、最大: 1MB'),
  }),
  callback: async (input) => {
    const { path, returnContent, maxContentLength } = input;

    // リクエストコンテキストからユーザーIDを取得
    const context = getCurrentContext();
    if (!context?.userId) {
      logger.error('❌ S3ファイル取得失敗: ユーザーIDが取得できません');
      return '❌ エラー: ユーザー認証情報が見つかりません。再度ログインしてください。';
    }

    const userId = context.userId;
    const bucketName = process.env.USER_STORAGE_BUCKET_NAME;

    if (!bucketName) {
      logger.error('❌ S3ファイル取得失敗: バケット名が設定されていません');
      return '❌ エラー: ストレージ設定が不完全です（USER_STORAGE_BUCKET_NAME未設定）';
    }

    const normalizedPath = normalizePath(path);
    const key = `${getUserStoragePrefix(userId)}/${normalizedPath}`;

    logger.info(`📥 S3ファイル取得: user=${userId}, path=${path}, returnContent=${returnContent}`);

    try {
      // まずファイルのメタデータを取得
      const headCommand = new HeadObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      const metadata = await s3Client.send(headCommand);
      const fileSize = metadata.ContentLength || 0;
      const contentType = metadata.ContentType || 'application/octet-stream';

      logger.info(
        `📄 ファイル情報: size=${formatFileSize(fileSize)}, type=${contentType}, lastModified=${metadata.LastModified}`
      );

      // ファイルが大きすぎる、またはバイナリファイルの場合は署名付きURL
      const isText = isTextFile(contentType);
      const shouldReturnContent = returnContent && isText && fileSize <= maxContentLength;

      if (!shouldReturnContent) {
        // 署名付きURLを生成
        const getCommand = new GetObjectCommand({
          Bucket: bucketName,
          Key: key,
        });

        const expiresIn = 3600; // 1時間
        const downloadUrl = await getSignedUrl(s3Client, getCommand, { expiresIn });

        logger.info(`✅ 署名付きURL生成完了: expires=${expiresIn}s`);

        let reason = '';
        if (!returnContent) {
          reason = '（署名付きURLでのダウンロードが要求されました）';
        } else if (!isText) {
          reason = '（バイナリファイルのため、直接内容を返せません）';
        } else if (fileSize > maxContentLength) {
          reason = `（ファイルサイズが制限を超えています: ${formatFileSize(fileSize)} > ${formatFileSize(maxContentLength)}）`;
        }

        return `📥 S3ファイル - ダウンロードURL生成

ファイル: ${path}
サイズ: ${formatFileSize(fileSize)}
形式: ${contentType}
更新日時: ${metadata.LastModified?.toLocaleString('ja-JP')}

${reason}

🔗 ダウンロードURL:
${downloadUrl}

⏰ 有効期限: ${expiresIn / 60}分（${new Date(Date.now() + expiresIn * 1000).toLocaleString('ja-JP')}まで）

このURLを使用してファイルをダウンロードできます。`;
      }

      // テキストファイルの内容を直接取得
      const getCommand = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      const response = await s3Client.send(getCommand);

      if (!response.Body) {
        throw new Error('ファイルの内容を取得できませんでした');
      }

      // ストリームをテキストに変換
      const bodyString = await response.Body.transformToString('utf-8');

      logger.info(`✅ ファイル内容取得完了: ${bodyString.length}文字`);

      // 内容が長すぎる場合は切り詰める
      const truncated = bodyString.length > maxContentLength;
      const content = truncated ? bodyString.substring(0, maxContentLength) : bodyString;

      let output = `📄 S3ファイル - 内容\n\n`;
      output += `ファイル: ${path}\n`;
      output += `サイズ: ${formatFileSize(fileSize)}\n`;
      output += `形式: ${contentType}\n`;
      output += `更新日時: ${metadata.LastModified?.toLocaleString('ja-JP')}\n`;

      if (truncated) {
        output += `\n⚠️ 注意: ファイルが長すぎるため、最初の ${formatFileSize(maxContentLength)} のみ表示しています。\n`;
        output += `完全な内容を取得するには、returnContent=false を指定してダウンロードURLを取得してください。\n`;
      }

      output += `\n${'─'.repeat(60)}\n`;
      output += content;
      output += `\n${'─'.repeat(60)}\n`;

      if (truncated) {
        output += `\n（... 残り ${formatFileSize(bodyString.length - maxContentLength)} 省略）`;
      }

      return output;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`❌ S3ファイル取得エラー: ${errorMessage}`);

      // NotFound エラーの場合
      if (errorMessage.includes('NotFound') || errorMessage.includes('NoSuchKey')) {
        return `❌ ファイルが見つかりません
パス: ${path}

指定されたファイルは存在しません。
s3_list_files ツールを使用して、利用可能なファイルを確認してください。`;
      }

      return `❌ ファイルの取得中にエラーが発生しました
パス: ${path}
エラー: ${errorMessage}

考えられる原因:
1. 指定されたファイルが存在しない
2. ファイルへのアクセス権限がない
3. S3バケットへの接続に問題がある
4. AWS認証情報の問題`;
    }
  },
});
