/**
 * Memory API クライアント
 * Backend の Memory API を呼び出すためのクライアント
 */

import { backendGet, backendPost, backendDelete } from './client/backend-client';

/**
 * メモリレコードの型定義
 */
export interface MemoryRecord {
  recordId: string;
  namespace: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * メモリレコード一覧の型定義
 */
export interface MemoryRecordList {
  records: MemoryRecord[];
  nextToken?: string;
}

/**
 * セマンティック検索のリクエスト型定義
 */
export interface SearchMemoryRequest {
  query: string;
  topK?: number;
  relevanceScore?: number;
}

/**
 * セマンティック検索のレスポンス型定義
 */
interface SearchMemoryResponse {
  records: MemoryRecord[];
}

/**
 * メモリレコード一覧を取得
 * @returns メモリレコード一覧
 */
export async function fetchMemoryRecords(): Promise<MemoryRecordList> {
  return backendGet<MemoryRecordList>('/memory/records');
}

/**
 * メモリレコードを削除
 * @param recordId レコードID
 */
export async function deleteMemoryRecord(recordId: string): Promise<void> {
  return backendDelete<void>(`/memory/records/${recordId}`);
}

/**
 * メモリレコードをセマンティック検索
 * @param searchRequest 検索リクエスト
 * @returns 検索結果
 */
export async function searchMemoryRecords(
  searchRequest: SearchMemoryRequest
): Promise<MemoryRecord[]> {
  const data = await backendPost<SearchMemoryResponse>('/memory/search', searchRequest);
  return data.records;
}
