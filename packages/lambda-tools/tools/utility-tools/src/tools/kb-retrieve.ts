/**
 * Knowledge Base Retrieve ツール実装
 *
 * Amazon Bedrock Knowledge Base から関連するチャンクを取得するツール
 */

import { BedrockAgentRuntimeClient, RetrieveCommand } from '@aws-sdk/client-bedrock-agent-runtime';
import { ToolInput, ToolResult } from '../types.js';
import { Tool, ToolValidationError } from './types.js';
import { logger } from '../logger.js';

/**
 * Knowledge Base Retrieve ツールの入力型
 */
interface KbRetrieveInput extends ToolInput {
  knowledgeBaseId?: string;
  query?: string;
  numberOfResults?: number;
}

/**
 * Knowledge Base Retrieve ツールの出力型
 */
interface KbRetrieveResult extends ToolResult {
  retrievedChunks: {
    content: string;
    score?: number;
    location?: {
      type: string;
      uri?: string;
    };
    metadata?: Record<string, unknown>;
  }[];
  totalCount: number;
  knowledgeBaseId: string;
  query: string;
}

/**
 * Bedrock Agent Runtime クライアントのインスタンス
 */
const bedrockClient = new BedrockAgentRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

/**
 * Knowledge Base Retrieve ツールのメイン処理
 *
 * @param input 入力データ
 * @returns Knowledge Base からの検索結果
 */
async function handleKbRetrieve(input: ToolInput): Promise<KbRetrieveResult> {
  const kbInput = input as KbRetrieveInput;

  // 入力検証
  if (!kbInput.knowledgeBaseId) {
    throw new ToolValidationError(
      "Knowledge Base Retrieve tool requires a 'knowledgeBaseId' parameter",
      'kb-retrieve',
      'knowledgeBaseId'
    );
  }

  if (!kbInput.query) {
    throw new ToolValidationError(
      "Knowledge Base Retrieve tool requires a 'query' parameter",
      'kb-retrieve',
      'query'
    );
  }

  const knowledgeBaseId = kbInput.knowledgeBaseId;
  const query = kbInput.query;
  const numberOfResults = kbInput.numberOfResults || 5;

  // 検索パラメータのログ出力
  logger.info('KB_RETRIEVE_START', {
    knowledgeBaseId,
    query: query.substring(0, 100), // ログ用に短縮
    numberOfResults,
  });

  try {
    // Bedrock Knowledge Base から検索を実行
    const command = new RetrieveCommand({
      knowledgeBaseId: knowledgeBaseId,
      retrievalQuery: {
        text: query,
      },
      retrievalConfiguration: {
        vectorSearchConfiguration: {
          numberOfResults: numberOfResults,
        },
      },
    });

    const response = await bedrockClient.send(command);

    // レスポンスの処理
    const retrievalResults = response.retrievalResults || [];
    const retrievedChunks = retrievalResults.map((result) => ({
      content: result.content?.text || '',
      score: result.score,
      location: result.location
        ? {
            type: result.location.type || 'UNKNOWN',
            uri: result.location.s3Location?.uri,
          }
        : undefined,
      metadata: result.metadata || {},
    }));

    // 検索結果のログ出力
    logger.info('KB_RETRIEVE_SUCCESS', {
      knowledgeBaseId,
      totalChunks: retrievedChunks.length,
      averageScore:
        retrievedChunks.length > 0
          ? retrievedChunks.reduce((sum, chunk) => sum + (chunk.score || 0), 0) /
            retrievedChunks.length
          : 0,
      hasResults: retrievedChunks.length > 0,
    });

    // 結果を生成
    const result: KbRetrieveResult = {
      retrievedChunks,
      totalCount: retrievedChunks.length,
      knowledgeBaseId,
      query,
    };

    return result;
  } catch (error) {
    // エラーログ出力
    logger.error('KB_RETRIEVE_ERROR', {
      knowledgeBaseId,
      query: query.substring(0, 100),
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
    });

    // エラーを再投げ
    throw error;
  }
}

/**
 * Knowledge Base Retrieve ツールの定義
 */
export const kbRetrieveTool: Tool = {
  name: 'kb-retrieve',
  handler: handleKbRetrieve,
  description: 'Retrieve relevant chunks from Amazon Bedrock Knowledge Base using semantic search',
  version: '1.0.0',
  tags: ['knowledge-base', 'search', 'retrieval', 'bedrock'],
};

export default kbRetrieveTool;
