/**
 * Amazon Nova Reel Tool Types
 */

/**
 * Nova Reel action type
 */
export type NovaReelAction = 'start' | 'status' | 'list';

/**
 * Video duration (in seconds)
 */
export type VideoDuration = 6 | 120;

/**
 * Video resolution
 */
export type VideoDimension = '1280x720' | '720x1280' | '1280x1280';

/**
 * Job status
 */
export type JobStatus = 'InProgress' | 'Completed' | 'Failed';

/**
 * Sort order
 */
export type SortOrder = 'Ascending' | 'Descending';

/**
 * Input parameters for starting video generation
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
 * Input parameters for checking job status
 */
export interface StatusInput {
  action: 'status';
  invocationArn: string;
  waitForCompletion?: boolean;
  pollingInterval?: number;
  maxWaitTime?: number;
}

/**
 * Input parameters for listing jobs
 */
export interface ListJobsInput {
  action: 'list';
  statusFilter?: JobStatus;
  maxResults?: number;
  sortOrder?: SortOrder;
}

/**
 * Input type for Nova Reel tool (Union)
 */
export type NovaReelInput = StartVideoInput | StatusInput | ListJobsInput;

/**
 * Output for starting video generation
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
 * Output for checking job status
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
 * Job information
 */
export interface JobInfo {
  invocationArn: string;
  status: JobStatus;
  submitTime: string;
  endTime?: string;
  outputS3Uri?: string;
}

/**
 * Output for listing jobs
 */
export interface ListJobsOutput {
  success: boolean;
  action: 'list';
  jobs: JobInfo[];
  count: number;
  message: string;
}

/**
 * Output type for Nova Reel tool (Union)
 */
export type NovaReelOutput = StartVideoOutput | StatusOutput | ListJobsOutput;

/**
 * Nova Reel API request (Text to Video)
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
 * Nova Reel API request (Image to Video)
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
 * Nova Reel API request type
 */
export type NovaReelRequest = NovaReelTextToVideoRequest | NovaReelImageToVideoRequest;

/**
 * Async Invoke response
 */
export interface AsyncInvokeResponse {
  invocationArn: string;
}

/**
 * Get Async Invoke response
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
 * List Async Invokes response
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
