/**
 * S3 Upload File ツール - ファイルのアップロード
 */

import { tool } from '@strands-agents/sdk';
import { z } from 'zod';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getCurrentContext } from '../context/request-context.js';
import { logger } from '../config/index.js';

const s3Client = new S3Client({ region: process.env.AWS_REGION });

// Bedrock Converse API の制限を考慮したファイルサイズ上限
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024; // 5MB

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
 * 拡張子からContent-Typeを推測
 */
function guessContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const contentTypeMap: Record<string, string> = {
    // テキストファイル
    txt: 'text/plain',
    md: 'text/markdown',
    csv: 'text/csv',
    html: 'text/html',
    css: 'text/css',
    xml: 'application/xml',

    // プログラミング言語
    js: 'application/javascript',
    ts: 'application/typescript',
    json: 'application/json',
    py: 'text/x-python',
    java: 'text/x-java',
    cpp: 'text/x-c++src',
    c: 'text/x-c',
    go: 'text/x-go',
    rs: 'text/x-rust',

    // 設定ファイル
    yaml: 'application/x-yaml',
    yml: 'application/x-yaml',
    toml: 'application/toml',
    ini: 'text/plain',
    conf: 'text/plain',

    // ドキュメント
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

    // 画像
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',

    // その他
    zip: 'application/zip',
    tar: 'application/x-tar',
    gz: 'application/gzip',
  };

  return ext && contentTypeMap[ext] ? contentTypeMap[ext] : 'application/octet-stream';
}

/**
 * S3 Upload File ツール
 */
export const s3UploadFileTool = tool({
  name: 's3_upload_file',
  description:
    'ユーザーのS3ストレージにテキストコンテンツをファイルとしてアップロードします。コード、ドキュメント、設定ファイルなどを保存できます。',
  inputSchema: z.object({
    path: z
      .string()
      .describe('アップロード先のファイルパス（必須）。例: "/notes/memo.txt", "/code/sample.py"'),
    content: z.string().describe('ファイルの内容（必須）。テキストベースのコンテンツ'),
    contentType: z
      .string()
      .optional()
      .describe(
        'MIMEタイプ（オプション）。指定しない場合はファイル名から自動推測。例: "text/plain", "application/json"'
      ),
  }),
  callback: async (input) => {
    const { path, content, contentType } = input;

    // リクエストコンテキストからユーザーIDを取得
    const context = getCurrentContext();
    if (!context?.userId) {
      logger.error('❌ S3アップロード失敗: ユーザーIDが取得できません');
      return '❌ エラー: ユーザー認証情報が見つかりません。再度ログインしてください。';
    }

    const userId = context.userId;
    const bucketName = process.env.USER_STORAGE_BUCKET_NAME;

    if (!bucketName) {
      logger.error('❌ S3アップロード失敗: バケット名が設定されていません');
      return '❌ エラー: ストレージ設定が不完全です（USER_STORAGE_BUCKET_NAME未設定）';
    }

    // ファイルサイズチェック
    const contentSize = Buffer.byteLength(content, 'utf-8');
    if (contentSize > MAX_UPLOAD_SIZE) {
      logger.warn(
        `⚠️ ファイルサイズが大きすぎます: ${formatFileSize(contentSize)} > ${formatFileSize(MAX_UPLOAD_SIZE)}`
      );
      return `❌ ファイルサイズが大きすぎます
アップロードしようとしたサイズ: ${formatFileSize(contentSize)}
最大許容サイズ: ${formatFileSize(MAX_UPLOAD_SIZE)}

より小さなファイルに分割するか、内容を削減してください。`;
    }

    const normalizedPath = normalizePath(path);
    const key = `${getUserStoragePrefix(userId)}/${normalizedPath}`;
    const filename = normalizedPath.split('/').pop() || 'unknown';

    // Content-Typeの決定
    const finalContentType = contentType || guessContentType(filename);

    logger.info(
      `📤 S3ファイルアップロード: user=${userId}, path=${path}, size=${formatFileSize(contentSize)}, type=${finalContentType}`
    );

    try {
      // ファイルをS3にアップロード
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: content,
        ContentType: finalContentType,
        // メタデータ
        Metadata: {
          'uploaded-by': 'ai-agent',
          'upload-timestamp': new Date().toISOString(),
        },
      });

      await s3Client.send(command);

      logger.info(`✅ S3アップロード完了: ${key}`);

      // ダウンロード用の署名付きURLを生成
      const getCommand = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      const expiresIn = 3600; // 1時間
      const downloadUrl = await getSignedUrl(s3Client, getCommand, { expiresIn });
      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      logger.info(`✅ Presigned URL生成完了: expires=${expiresIn}s`);

      return `✅ ファイルをS3にアップロードしました

ファイル: ${path}
サイズ: ${formatFileSize(contentSize)}
形式: ${finalContentType}
アップロード日時: ${new Date().toLocaleString('ja-JP')}

🔗 ダウンロードURL:
${downloadUrl}

⏰ 有効期限: ${expiresIn / 60}分（${expiresAt.toLocaleString('ja-JP')}まで）

ファイルは正常に保存されました。
上記のURLを使用してファイルをダウンロードできます。`;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`❌ S3アップロードエラー: ${errorMessage}`);

      return `❌ ファイルのアップロード中にエラーが発生しました
パス: ${path}
サイズ: ${formatFileSize(contentSize)}
エラー: ${errorMessage}

考えられる原因:
1. S3バケットへの書き込み権限がない
2. ファイルパスが不正（使用できない文字が含まれている）
3. ネットワーク接続の問題
4. AWS認証情報の問題`;
    }
  },
});
