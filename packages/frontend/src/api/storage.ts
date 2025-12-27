/**
 * Storage API Client
 * ユーザーファイルストレージAPI
 */

import { getValidAccessToken } from '../lib/cognito';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

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

export interface FolderNode {
  path: string;
  name: string;
  children: FolderNode[];
}

export interface FolderTreeResponse {
  tree: FolderNode[];
}

/**
 * 認証ヘッダーを作成（自動トークンリフレッシュ付き）
 */
async function createAuthHeaders(): Promise<Record<string, string>> {
  const accessToken = await getValidAccessToken();

  if (!accessToken) {
    throw new Error('認証が必要です。再ログインしてください。');
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };
}

/**
 * ディレクトリ一覧を取得
 */
export async function listStorageItems(path: string = '/'): Promise<ListStorageResponse> {
  const url = new URL(`${API_BASE_URL}/storage/list`);
  url.searchParams.append('path', path);

  const headers = await createAuthHeaders();

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to list storage items: ${response.statusText}`);
  }

  return response.json();
}

/**
 * ファイルアップロード用の署名付きURLを生成
 */
export async function generateUploadUrl(
  fileName: string,
  path: string = '/',
  contentType?: string
): Promise<UploadUrlResponse> {
  const headers = await createAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/storage/upload`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      fileName,
      path,
      contentType,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to generate upload URL: ${response.statusText}`);
  }

  return response.json();
}

/**
 * 署名付きURLを使用してS3にファイルをアップロード
 */
export async function uploadFileToS3(uploadUrl: string, file: File): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: file,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload file to S3: ${response.statusText}`);
  }
}

/**
 * ディレクトリを作成
 */
export async function createDirectory(directoryName: string, path: string = '/') {
  const headers = await createAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/storage/directory`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      directoryName,
      path,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create directory: ${response.statusText}`);
  }

  return response.json();
}

/**
 * ファイルを削除
 */
export async function deleteFile(path: string) {
  const url = new URL(`${API_BASE_URL}/storage/file`);
  url.searchParams.append('path', path);

  const headers = await createAuthHeaders();

  const response = await fetch(url.toString(), {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to delete file: ${response.statusText}`);
  }

  return response.json();
}

/**
 * ディレクトリを削除
 * @param path ディレクトリパス
 * @param force true の場合、ディレクトリ内のすべてのファイルを含めて削除
 */
export async function deleteDirectory(path: string, force: boolean = false) {
  const url = new URL(`${API_BASE_URL}/storage/directory`);
  url.searchParams.append('path', path);
  if (force) {
    url.searchParams.append('force', 'true');
  }

  const headers = await createAuthHeaders();

  const response = await fetch(url.toString(), {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to delete directory: ${response.statusText}`);
  }

  return response.json();
}

/**
 * ファイルダウンロード用の署名付きURLを生成
 */
export async function generateDownloadUrl(path: string): Promise<string> {
  const url = new URL(`${API_BASE_URL}/storage/download`);
  url.searchParams.append('path', path);

  const headers = await createAuthHeaders();

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to generate download URL: ${response.statusText}`);
  }

  const data = await response.json();
  return data.downloadUrl;
}

/**
 * フォルダツリー構造を取得
 */
export async function fetchFolderTree(): Promise<FolderTreeResponse> {
  const headers = await createAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/storage/tree`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch folder tree: ${response.statusText}`);
  }

  return response.json();
}

/**
 * フォルダダウンロード用のファイル情報
 */
export interface DownloadFileInfo {
  relativePath: string;
  downloadUrl: string;
  size: number;
}

export interface FolderDownloadInfo {
  files: DownloadFileInfo[];
  totalSize: number;
  fileCount: number;
}

export interface DownloadProgress {
  current: number;
  total: number;
  percentage: number;
  currentFile: string;
}

/**
 * フォルダ内のすべてのファイル情報を取得
 */
export async function getFolderDownloadInfo(path: string): Promise<FolderDownloadInfo> {
  const url = new URL(`${API_BASE_URL}/storage/download-folder`);
  url.searchParams.append('path', path);

  const headers = await createAuthHeaders();

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      errorData.message || `Failed to get folder download info: ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * フォルダを一括ダウンロード（ZIP形式）
 */
export async function downloadFolder(
  folderPath: string,
  folderName: string,
  onProgress?: (progress: DownloadProgress) => void,
  signal?: AbortSignal
): Promise<void> {
  const JSZip = (await import('jszip')).default;
  const { saveAs } = await import('file-saver');

  // フォルダ内のファイル情報を取得
  const downloadInfo = await getFolderDownloadInfo(folderPath);

  if (downloadInfo.fileCount === 0) {
    throw new Error('Folder is empty');
  }

  // ZIPファイルを作成
  const zip = new JSZip();
  let downloadedCount = 0;

  // 各ファイルをダウンロードしてZIPに追加
  for (const file of downloadInfo.files) {
    // キャンセルチェック
    if (signal?.aborted) {
      throw new Error('Download cancelled');
    }

    // 進捗を通知
    if (onProgress) {
      onProgress({
        current: downloadedCount,
        total: downloadInfo.fileCount,
        percentage: Math.round((downloadedCount / downloadInfo.fileCount) * 100),
        currentFile: file.relativePath,
      });
    }

    try {
      // ファイルをダウンロード
      const response = await fetch(file.downloadUrl, { signal });

      if (!response.ok) {
        console.error(`Failed to download file: ${file.relativePath}`);
        continue;
      }

      const blob = await response.blob();

      // ZIPに追加
      zip.file(file.relativePath, blob);

      downloadedCount++;
    } catch (error) {
      if (signal?.aborted) {
        throw new Error('Download cancelled');
      }
      console.error(`Error downloading file ${file.relativePath}:`, error);
      // エラーが発生してもスキップして続行
      downloadedCount++;
    }
  }

  // 最終進捗を通知
  if (onProgress) {
    onProgress({
      current: downloadedCount,
      total: downloadInfo.fileCount,
      percentage: 100,
      currentFile: 'Creating ZIP file...',
    });
  }

  // ZIPファイルを生成してダウンロード
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  saveAs(zipBlob, `${folderName}.zip`);
}
