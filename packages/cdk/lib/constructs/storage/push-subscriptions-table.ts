import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface PushSubscriptionsTableProps {
  /**
   * Table name prefix
   */
  readonly tableNamePrefix: string;

  /**
   * Removal policy for the table (default: RETAIN)
   */
  readonly removalPolicy?: cdk.RemovalPolicy;

  /**
   * Point-in-time recovery enabled (default: true)
   */
  readonly pointInTimeRecovery?: boolean;
}

/**
 * DynamoDB table for storing Web Push notification subscriptions
 *
 * Table structure:
 * - PK: userId (String) — Cognito user ID
 * - SK: endpoint (String) — Push subscription endpoint URL
 *
 * Attributes:
 * - p256dh: String — Client public key for push encryption
 * - auth: String — Authentication secret
 * - createdAt: String — Subscription creation timestamp
 * - userAgent: String — Device identification
 *
 * TTL: expiresAt — Auto-delete stale subscriptions (90 days)
 */
export class PushSubscriptionsTable extends Construct {
  /**
   * The DynamoDB table
   */
  public readonly table: dynamodb.Table;

  /**
   * The table name
   */
  public readonly tableName: string;

  /**
   * The table ARN
   */
  public readonly tableArn: string;

  constructor(scope: Construct, id: string, props: PushSubscriptionsTableProps) {
    super(scope, id);

    this.table = new dynamodb.Table(this, 'Table', {
      tableName: `${props.tableNamePrefix}-push-subscriptions`,
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'endpoint',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: props.removalPolicy || cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: props.pointInTimeRecovery ?? true,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      timeToLiveAttribute: 'expiresAt',
    });

    this.tableName = this.table.tableName;
    this.tableArn = this.table.tableArn;

    cdk.Tags.of(this.table).add('Component', 'PushNotifications');
    cdk.Tags.of(this.table).add('Purpose', 'WebPushSubscriptionStorage');
  }

  /**
   * Grant read permissions to a principal
   */
  public grantRead(grantee: cdk.aws_iam.IGrantable): void {
    this.table.grantReadData(grantee);
  }

  /**
   * Grant write permissions to a principal
   */
  public grantWrite(grantee: cdk.aws_iam.IGrantable): void {
    this.table.grantWriteData(grantee);
  }

  /**
   * Grant read/write permissions to a principal
   */
  public grantReadWrite(grantee: cdk.aws_iam.IGrantable): void {
    this.table.grantReadWriteData(grantee);
  }
}
