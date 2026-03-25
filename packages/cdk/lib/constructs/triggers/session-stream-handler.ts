/**
 * Session Stream Handler Lambda
 *
 * This construct creates a Lambda function that processes DynamoDB Streams
 * from the Sessions table and publishes events to AppSync Events API.
 * Also sends Web Push notifications when agents complete.
 */
import * as cdk from 'aws-cdk-lib';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { AppSyncEvents } from '../api';
import * as path from 'path';

export interface SessionStreamHandlerProps {
  /**
   * The DynamoDB table with streams enabled
   */
  readonly sessionsTable: dynamodb.ITable;

  /**
   * The AppSync Events construct
   */
  readonly appsyncEvents: AppSyncEvents;

  /**
   * Push subscriptions DynamoDB table (optional, enables Push notifications)
   */
  readonly pushSubscriptionsTable?: dynamodb.ITable;

  /**
   * Agents DynamoDB table (optional, for resolving agent names in Push notifications)
   */
  readonly agentsTable?: dynamodb.ITable;

  /**
   * VAPID keys secret name in Secrets Manager (optional, required for Push notifications)
   */
  readonly vapidKeysSecretName?: string;

  /**
   * Lambda function timeout (default: 30 seconds)
   */
  readonly timeout?: cdk.Duration;

  /**
   * CloudWatch Logs retention (default: 1 week)
   */
  readonly logRetention?: logs.RetentionDays;
}

/**
 * Lambda function that handles DynamoDB Streams and publishes to AppSync Events
 */
export class SessionStreamHandler extends Construct {
  /**
   * The Lambda function
   */
  public readonly handler: nodejs.NodejsFunction;

  constructor(scope: Construct, id: string, props: SessionStreamHandlerProps) {
    super(scope, id);

    const region = cdk.Stack.of(this).region;
    const account = cdk.Stack.of(this).account;

    // Build environment variables
    const environment: Record<string, string> = {
      APPSYNC_HTTP_ENDPOINT: props.appsyncEvents.httpEndpoint,
    };

    if (props.pushSubscriptionsTable) {
      environment.PUSH_SUBSCRIPTIONS_TABLE_NAME = props.pushSubscriptionsTable.tableName;
    }
    if (props.agentsTable) {
      environment.AGENTS_TABLE_NAME = props.agentsTable.tableName;
    }
    if (props.vapidKeysSecretName) {
      environment.VAPID_KEYS_SECRET_NAME = props.vapidKeysSecretName;
    }

    // Create Lambda function using NodejsFunction for bundling
    this.handler = new nodejs.NodejsFunction(this, 'Handler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../../../../session-stream-handler/src/index.ts'),
      handler: 'handler',
      environment,
      timeout: props.timeout || cdk.Duration.seconds(30),
      memorySize: 256,
      logRetention: props.logRetention || logs.RetentionDays.ONE_WEEK,
      description: 'Processes DynamoDB Streams and publishes to AppSync Events + Push notifications',
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'es2022',
        externalModules: ['aws-sdk'],
      },
    });

    // Add DynamoDB Streams event source
    this.handler.addEventSource(
      new lambdaEventSources.DynamoEventSource(props.sessionsTable, {
        startingPosition: lambda.StartingPosition.LATEST,
        batchSize: 10,
        retryAttempts: 3,
        reportBatchItemFailures: true,
      })
    );

    // Grant permission to publish to AppSync Events
    props.appsyncEvents.grantPublish(this.handler);

    // Grant stream read access
    props.sessionsTable.grantStreamRead(this.handler);

    // Grant Push notification related permissions
    if (props.pushSubscriptionsTable) {
      props.pushSubscriptionsTable.grantReadWriteData(this.handler);
    }
    if (props.agentsTable) {
      props.agentsTable.grantReadData(this.handler);
    }
    if (props.vapidKeysSecretName) {
      this.handler.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ['secretsmanager:GetSecretValue'],
          resources: [
            `arn:aws:secretsmanager:${region}:${account}:secret:${props.vapidKeysSecretName}*`,
          ],
        })
      );
    }

    // Add tags
    cdk.Tags.of(this.handler).add('Component', 'RealTimeEvents');
    cdk.Tags.of(this.handler).add('Purpose', 'SessionStreamHandler');
  }
}
