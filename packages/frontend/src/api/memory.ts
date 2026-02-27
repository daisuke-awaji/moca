/**
 * Memory API Client
 * Client for calling the Backend Memory API
 */

import { backendClient } from './client/backend-client';

/**
 * Type definition for memory record
 */
export interface MemoryRecord {
  recordId: string;
  namespace: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Type definition for memory record list
 */
export interface MemoryRecordList {
  records: MemoryRecord[];
  nextToken?: string;
}

/**
 * Type definition for semantic search request
 */
export interface SearchMemoryRequest {
  query: string;
  topK?: number;
  relevanceScore?: number;
}

/**
 * Type definition for semantic search response
 */
interface SearchMemoryResponse {
  records: MemoryRecord[];
}

/**
 * Fetch memory record list
 * @returns Memory record list
 */
export async function fetchMemoryRecords(): Promise<MemoryRecordList> {
  return backendClient.get<MemoryRecordList>('/memory/records');
}

/**
 * Delete a memory record
 * @param recordId Record ID
 */
export async function deleteMemoryRecord(recordId: string): Promise<void> {
  return backendClient.delete<void>(`/memory/records/${recordId}`);
}

/**
 * Semantic search for memory records
 * @param searchRequest Search request
 * @returns Search results
 */
export async function searchMemoryRecords(
  searchRequest: SearchMemoryRequest
): Promise<MemoryRecord[]> {
  const data = await backendClient.post<SearchMemoryResponse>('/memory/search', searchRequest);
  return data.records;
}
