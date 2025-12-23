/**
 * User Storage Construct
 * ユーザーごとのファイルストレージ（S3）を提供
 */

import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface UserStorageProps {
  /**
   * バケット名プレフィックス（オプション）
   * 実際のバケット名: {prefix}-user-storage-{account}-{region}
   */
  readonly bucketNamePrefix?: string;

  /**
   * データ保持期間（日数）
   * デフォルト: 365日（1年）
   */
  readonly retentionDays?: number;

  /**
   * CORSで許可するオリジン
   * デフォルト: ['*']（開発用）
   */
  readonly corsAllowedOrigins?: string[];
}

/**
 * User Storage Construct
 * ユーザーファイル用のS3バケットとアクセス制御を提供
 */
export class UserStorage extends Construct {
  /**
   * 作成されたS3バケット
   */
  public readonly bucket: s3.Bucket;

  /**
   * バケット名
   */
  public readonly bucketName: string;

  /**
   * バケットARN
   */
  public readonly bucketArn: string;

  constructor(scope: Construct, id: string, props?: UserStorageProps) {
    super(scope, id);

    const stack = cdk.Stack.of(this);
    const prefix = props?.bucketNamePrefix || 'agentcore';
    const retentionDays = props?.retentionDays || 365;
    const corsAllowedOrigins = props?.corsAllowedOrigins || ['*'];

    // S3バケット作成
    this.bucket = new s3.Bucket(this, 'UserStorageBucket', {
      bucketName: `${prefix}-user-storage-${stack.account}-${stack.region}`,
      // セキュリティ設定
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true, // バージョニング有効化
      enforceSSL: true, // SSL/TLS接続を強制

      // ライフサイクル設定
      lifecycleRules: [
        {
          id: 'DeleteOldVersions',
          noncurrentVersionExpiration: cdk.Duration.days(30), // 古いバージョンは30日後に削除
        },
        {
          id: 'ExpireDeleteMarkers',
          expiredObjectDeleteMarker: true, // 削除マーカーの自動削除
        },
      ],

      // 自動削除設定（開発環境用）
      removalPolicy: cdk.RemovalPolicy.RETAIN, // 本番では保持
      autoDeleteObjects: false, // 本番では無効化

      // CORS設定（フロントエンドからの直接アップロード用）
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.DELETE,
            s3.HttpMethods.HEAD,
          ],
          allowedOrigins: corsAllowedOrigins,
          allowedHeaders: ['*'],
          exposedHeaders: ['ETag', 'x-amz-version-id'],
          maxAge: 3000,
        },
      ],
    });

    this.bucketName = this.bucket.bucketName;
    this.bucketArn = this.bucket.bucketArn;

    // タグ追加
    cdk.Tags.of(this.bucket).add('Component', 'UserStorage');
    cdk.Tags.of(this.bucket).add('RetentionDays', retentionDays.toString());
  }

  /**
   * Lambda関数にS3へのフルアクセス権限を付与
   * ユーザーごとのプレフィックス制限は実装レベルで行う
   */
  public grantFullAccess(grantee: iam.IGrantable): iam.Grant {
    return this.bucket.grantReadWrite(grantee);
  }

  /**
   * Lambda関数に署名付きURL生成権限を付与
   */
  public grantPresignedUrlGeneration(grantee: iam.IGrantable): iam.Grant {
    return this.bucket.grantReadWrite(grantee);
  }

  /**
   * Lambda関数に読み取り専用権限を付与
   */
  public grantReadOnly(grantee: iam.IGrantable): iam.Grant {
    return this.bucket.grantRead(grantee);
  }
}
