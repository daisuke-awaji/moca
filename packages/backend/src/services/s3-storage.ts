/**
 * S3 Storage Service
 * ユーザーごとのファイルストレージを提供
 */

import {
  S3Client,
  ListObjectsV2Command,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config/index.js';

const s3Client = new S3Client({ region: process.env.AWS_REGION });

export interface StorageItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  lastModified?: string;
  url?: string;
}

export interface ListStorageResponse {
  items: StorageItem[];
  path: string;
}

export interface UploadUrlResponse {
  uploadUrl: string;
  key: string;
  expiresIn: number;
}

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
 * ディレクトリ一覧を取得
 */
export async function listStorageItems(
  userId: string,
  path: string = '/'
): Promise<ListStorageResponse> {
  const bucketName = config.userStorageBucketName;
  if (!bucketName) {
    throw new Error('USER_STORAGE_BUCKET_NAME is not configured');
  }

  const normalizedPath = normalizePath(path);
  const prefix = normalizedPath
    ? `${getUserStoragePrefix(userId)}/${normalizedPath}/`
    : `${getUserStoragePrefix(userId)}/`;

  console.log(`📁 Listing storage items for user ${userId} at path: ${path} (prefix: ${prefix})`);

  const command = new ListObjectsV2Command({
    Bucket: bucketName,
    Prefix: prefix,
    Delimiter: '/',
  });

  const response = await s3Client.send(command);
  const items: StorageItem[] = [];

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
          lastModified: content.LastModified?.toISOString(),
        });
      }
    }
  }

  console.log(`✅ Found ${items.length} items`);

  return {
    items,
    path: `/${normalizedPath}`,
  };
}

/**
 * ファイルアップロード用の署名付きURLを生成
 */
export async function generateUploadUrl(
  userId: string,
  fileName: string,
  path: string = '/',
  contentType?: string
): Promise<UploadUrlResponse> {
  const bucketName = config.userStorageBucketName;
  if (!bucketName) {
    throw new Error('USER_STORAGE_BUCKET_NAME is not configured');
  }

  const normalizedPath = normalizePath(path);
  const key = normalizedPath
    ? `${getUserStoragePrefix(userId)}/${normalizedPath}/${fileName}`
    : `${getUserStoragePrefix(userId)}/${fileName}`;

  console.log(`📤 Generating upload URL for: ${key}`);

  // Note: ファイルサイズ制限は5MB（Bedrock Converse API制限を考慮）
  // 将来的にクライアント側またはサーバー側でバリデーションを追加する場合に参照
  // const maxFileSize = 5 * 1024 * 1024; // 5MB in bytes

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType || 'application/octet-stream',
  });

  const expiresIn = 3600; // 1時間
  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });

  console.log(`✅ Upload URL generated (expires in ${expiresIn}s)`);

  return {
    uploadUrl,
    key,
    expiresIn,
  };
}

/**
 * ディレクトリを作成
 * S3にはディレクトリという概念がないため、空のプレースホルダーオブジェクトを作成
 */
export async function createDirectory(userId: string, directoryName: string, path: string = '/') {
  const bucketName = config.userStorageBucketName;
  if (!bucketName) {
    throw new Error('USER_STORAGE_BUCKET_NAME is not configured');
  }

  const normalizedPath = normalizePath(path);
  const key = normalizedPath
    ? `${getUserStoragePrefix(userId)}/${normalizedPath}/${directoryName}/`
    : `${getUserStoragePrefix(userId)}/${directoryName}/`;

  console.log(`📁 Creating directory: ${key}`);

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: '',
  });

  await s3Client.send(command);

  console.log(`✅ Directory created: ${key}`);

  return {
    path: `/${normalizedPath}/${directoryName}`.replace(/\/+/g, '/'),
    name: directoryName,
  };
}

/**
 * ファイルを削除
 */
export async function deleteFile(userId: string, filePath: string) {
  const bucketName = config.userStorageBucketName;
  if (!bucketName) {
    throw new Error('USER_STORAGE_BUCKET_NAME is not configured');
  }

  const normalizedPath = normalizePath(filePath);
  const key = `${getUserStoragePrefix(userId)}/${normalizedPath}`;

  console.log(`🗑️  Deleting file: ${key}`);

  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  await s3Client.send(command);

  console.log(`✅ File deleted: ${key}`);

  return { deleted: true };
}

/**
 * ディレクトリを削除（空のディレクトリのみ）
 */
export async function deleteDirectory(userId: string, directoryPath: string) {
  const bucketName = config.userStorageBucketName;
  if (!bucketName) {
    throw new Error('USER_STORAGE_BUCKET_NAME is not configured');
  }

  const normalizedPath = normalizePath(directoryPath);
  const prefix = `${getUserStoragePrefix(userId)}/${normalizedPath}/`;

  console.log(`🗑️  Deleting directory: ${prefix}`);

  // ディレクトリ内のオブジェクトを確認
  const listCommand = new ListObjectsV2Command({
    Bucket: bucketName,
    Prefix: prefix,
  });

  const listResponse = await s3Client.send(listCommand);

  if (!listResponse.Contents || listResponse.Contents.length === 0) {
    throw new Error('Directory not found');
  }

  // プレースホルダーオブジェクトのみの場合は削除可能
  if (listResponse.Contents.length === 1 && listResponse.Contents[0].Key === prefix) {
    const deleteCommand = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: prefix,
    });

    await s3Client.send(deleteCommand);
    console.log(`✅ Directory deleted: ${prefix}`);
    return { deleted: true };
  }

  // ディレクトリが空でない場合はエラー
  throw new Error('Directory is not empty');
}

/**
 * ファイルのダウンロード用署名付きURLを生成
 */
export async function generateDownloadUrl(userId: string, filePath: string): Promise<string> {
  const bucketName = config.userStorageBucketName;
  if (!bucketName) {
    throw new Error('USER_STORAGE_BUCKET_NAME is not configured');
  }

  const normalizedPath = normalizePath(filePath);
  const key = `${getUserStoragePrefix(userId)}/${normalizedPath}`;

  console.log(`📥 Generating download URL for: ${key}`);

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  const expiresIn = 3600; // 1時間
  const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn });

  console.log(`✅ Download URL generated`);

  return downloadUrl;
}

/**
 * ファイルの存在確認
 */
export async function checkFileExists(userId: string, filePath: string): Promise<boolean> {
  const bucketName = config.userStorageBucketName;
  if (!bucketName) {
    throw new Error('USER_STORAGE_BUCKET_NAME is not configured');
  }

  const normalizedPath = normalizePath(filePath);
  const key = `${getUserStoragePrefix(userId)}/${normalizedPath}`;

  try {
    const command = new HeadObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    await s3Client.send(command);
    return true;
  } catch {
    return false;
  }
}
