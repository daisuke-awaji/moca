/**
 * Amazon Nova Reel Tool Types
 */

/**
 * Nova Reel アクション型
 */
export type NovaReelAction = 'start' | 'status' | 'list';

/**
 * 動画の長さ（秒）
 */
export type VideoDuration = 6 | 120;

/**
 * 動画の解像度
 */
export type VideoDimension = '1280x720' | '720x1280' | '1280x1280';

/**
 * ジョブステータス
 */
export type JobStatus = 'InProgress' | 'Completed' | 'Failed';

/**
 * ソート順
 */
export type SortOrder = 'Ascending' | 'Descending';

/**
 * 動画生成開始の入力パラメータ
 */
export interface StartVideoInput {
  action: 'start';
  prompt: string;
  negativePrompt?: string;
  imageBase64?: string;
  imageS3Uri?: string;
  duration?: VideoDuration;
  dimension?: VideoDimension;
  fps?: number;
  seed?: number;
  outputPath?: string;
  waitForCompletion?: boolean;
  pollingInterval?: number;
  maxWaitTime?: number;
}

/**
 * ジョブステータス確認の入力パラメータ
 */
export interface StatusInput {
  action: 'status';
  invocationArn: string;
  waitForCompletion?: boolean;
  pollingInterval?: number;
  maxWaitTime?: number;
}

/**
 * ジョブ一覧取得の入力パラメータ
 */
export interface ListJobsInput {
  action: 'list';
  statusFilter?: JobStatus;
  maxResults?: number;
  sortOrder?: SortOrder;
}

/**
 * Nova Reel ツールの入力型（Union）
 */
export type NovaReelInput = StartVideoInput | StatusInput | ListJobsInput;

/**
 * 動画生成開始の出力
 */
export interface StartVideoOutput {
  success: boolean;
  action: 'start';
  invocationArn: string;
  status: JobStatus;
  estimatedTime: string;
  outputS3Uri?: string;
  s3Path?: string;
  message: string;
}

/**
 * ジョブステータス確認の出力
 */
export interface StatusOutput {
  success: boolean;
  action: 'status';
  invocationArn: string;
  status: JobStatus;
  progress?: number;
  elapsedTime?: number;
  outputS3Uri?: string;
  s3Path?: string;
  failureMessage?: string;
  message: string;
}

/**
 * ジョブ情報
 */
export interface JobInfo {
  invocationArn: string;
  status: JobStatus;
  submitTime: string;
  endTime?: string;
  outputS3Uri?: string;
}

/**
 * ジョブ一覧取得の出力
 */
export interface ListJobsOutput {
  success: boolean;
  action: 'list';
  jobs: JobInfo[];
  count: number;
  message: string;
}

/**
 * Nova Reel ツールの出力型（Union）
 */
export type NovaReelOutput = StartVideoOutput | StatusOutput | ListJobsOutput;

/**
 * Nova Reel API リクエスト（Text to Video）
 */
export interface NovaReelTextToVideoRequest {
  taskType: 'TEXT_VIDEO';
  textToVideoParams: {
    text: string;
  };
  videoGenerationConfig: {
    durationSeconds: number;
    fps: number;
    dimension: VideoDimension;
    seed?: number;
  };
}

/**
 * Nova Reel API リクエスト（Image to Video）
 */
export interface NovaReelImageToVideoRequest {
  taskType: 'TEXT_VIDEO';
  textToVideoParams: {
    text: string;
    images?: Array<{
      format: 'png' | 'jpeg' | 'gif' | 'webp';
      source: {
        bytes: string;
      };
    }>;
  };
  videoGenerationConfig: {
    durationSeconds: number;
    fps: number;
    dimension: VideoDimension;
    seed?: number;
  };
}

/**
 * Nova Reel API リクエスト型
 */
export type NovaReelRequest = NovaReelTextToVideoRequest | NovaReelImageToVideoRequest;

/**
 * Async Invoke 応答
 */
export interface AsyncInvokeResponse {
  invocationArn: string;
}

/**
 * Get Async Invoke 応答
 */
export interface GetAsyncInvokeResponse {
  invocationArn: string;
  status: JobStatus;
  submitTime: Date;
  endTime?: Date;
  outputDataConfig?: {
    s3OutputDataConfig?: {
      s3Uri: string;
    };
  };
  failureMessage?: string;
}

/**
 * List Async Invokes 応答
 */
export interface ListAsyncInvokesResponse {
  asyncInvokeSummaries?: Array<{
    invocationArn: string;
    status: JobStatus;
    submitTime: Date;
    endTime?: Date;
    outputDataConfig?: {
      s3OutputDataConfig?: {
        s3Uri: string;
      };
    };
  }>;
  nextToken?: string;
}
