/**
 * Session Stream Handler Lambda
 *
 * Processes DynamoDB Streams events from the Sessions table
 * and publishes them to AppSync Events API for real-time updates.
 */
import type { DynamoDBStreamEvent, DynamoDBRecord } from 'aws-lambda';
import { SignatureV4 } from '@smithy/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import https from 'https';
import { URL } from 'url';

/**
 * Session event to publish
 */
interface SessionEvent {
  type: 'INSERT' | 'MODIFY' | 'REMOVE';
  sessionId: string;
  title?: string;
  agentId?: string;
  updatedAt?: string;
  createdAt?: string;
}

/**
 * HTTP response
 */
interface HttpResponse {
  statusCode: number;
  body: string;
}

/**
 * Parse DynamoDB Streams record to session event
 */
function parseRecord(record: DynamoDBRecord): SessionEvent | null {
  const eventName = record.eventName as 'INSERT' | 'MODIFY' | 'REMOVE';
  const image = record.dynamodb?.NewImage || record.dynamodb?.OldImage;

  if (!image) {
    return null;
  }

  return {
    type: eventName,
    sessionId: (image.sessionId as { S: string })?.S || '',
    title: (image.title as { S: string })?.S,
    agentId: (image.agentId as { S: string })?.S,
    updatedAt: (image.updatedAt as { S: string })?.S,
    createdAt: (image.createdAt as { S: string })?.S,
  };
}

/**
 * Make HTTPS request with signed headers
 */
async function makeRequest(
  url: string,
  options: https.RequestOptions,
  body: string
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, body: data });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/**
 * Publish event to AppSync Events API
 */
async function publishToAppSync(userId: string, event: SessionEvent): Promise<void> {
  const endpoint = process.env.APPSYNC_HTTP_ENDPOINT;
  const region = process.env.AWS_REGION || 'ap-northeast-1';

  if (!endpoint) {
    console.error('APPSYNC_HTTP_ENDPOINT not configured');
    return;
  }

  const channel = `/sessions/${userId}`;
  const url = new URL(endpoint);

  const body = JSON.stringify({
    channel,
    events: [JSON.stringify(event)],
  });

  // Create signer
  const signer = new SignatureV4({
    service: 'appsync',
    region,
    credentials: defaultProvider(),
    sha256: Sha256,
  });

  // Create request to sign
  const request = {
    method: 'POST',
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port ? parseInt(url.port) : 443,
    path: url.pathname,
    headers: {
      'Content-Type': 'application/json',
      host: url.hostname,
    },
    body,
  };

  // Sign the request
  const signedRequest = await signer.sign(request);

  // Make the request
  const options: https.RequestOptions = {
    hostname: url.hostname,
    port: 443,
    path: url.pathname,
    method: 'POST',
    headers: signedRequest.headers,
  };

  const response = await makeRequest(url.href, options, body);
  console.log(`Published to ${channel}:`, response);
}

/**
 * Lambda handler for DynamoDB Streams
 */
export const handler = async (
  event: DynamoDBStreamEvent
): Promise<{ statusCode: number; body: string }> => {
  console.log('Received DynamoDB Stream event:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    try {
      const userId = (record.dynamodb?.Keys?.userId as { S: string })?.S;
      if (!userId) {
        console.warn('No userId in record, skipping');
        continue;
      }

      const sessionEvent = parseRecord(record);
      if (!sessionEvent) {
        console.warn('Could not parse record, skipping');
        continue;
      }

      await publishToAppSync(userId, sessionEvent);
      console.log(`Published event for user ${userId}:`, sessionEvent);
    } catch (error) {
      console.error('Failed to process record:', error);
      // Don't throw - continue processing other records
    }
  }

  return { statusCode: 200, body: 'OK' };
};
