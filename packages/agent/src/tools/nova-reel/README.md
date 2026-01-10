# Amazon Nova Reel Tool

Amazon Nova Reelを使用してテキストプロンプトから動画を生成するためのツールです。

## 概要

Nova Reelツールは、Amazon Bedrockの動画生成モデル「Amazon Nova Reel」を使用して、テキストの説明から高品質な動画を生成します。Text-to-VideoとImage-to-Video（画像から動画）の両方に対応しており、非同期ジョブ管理機能を備えています。

### 主な特徴

- **Text-to-Video**: テキストプロンプトから動画を生成
- **Image-to-Video**: 画像とテキストプロンプトを組み合わせて動画を生成
- **非同期処理**: 長時間の動画生成を非同期ジョブとして実行
- **ジョブ管理**: ジョブのステータス確認と一覧表示
- **自動S3保存**: 生成された動画を自動的にS3ストレージに保存

## 機能

Nova Reelツールは3つのアクションをサポートしています：

### 1. start - 動画生成の開始

テキストプロンプトから動画生成ジョブを開始します。

**主なパラメータ:**
- `prompt`: 動画生成のためのテキストプロンプト（必須）
- `duration`: 動画の長さ（6秒または120秒、デフォルト: 6秒）
- `dimension`: 解像度（1280x720、720x1280、1280x1280）
- `imageBase64`: Image-to-Video用のBase64エンコードされた画像（オプション）
- `waitForCompletion`: 完了まで待機するかどうか（デフォルト: false）

### 2. status - ジョブステータスの確認

生成ジョブのステータスを確認します。

**主なパラメータ:**
- `invocationArn`: ジョブのARN（必須）
- `waitForCompletion`: 完了まで待機するかどうか（オプション）

**ステータス:**
- `InProgress`: 生成中
- `Completed`: 完了
- `Failed`: 失敗

### 3. list - ジョブ一覧の取得

動画生成ジョブの一覧を取得します。

**主なパラメータ:**
- `statusFilter`: ステータスでフィルタリング（InProgress、Completed、Failed）
- `maxResults`: 最大取得件数（デフォルト: 10）
- `sortOrder`: ソート順（Ascending、Descending）

## 使用方法

### 基本的な動画生成（Text-to-Video）

```typescript
import { novaReelTool } from './tools/nova-reel';

// 6秒の動画を生成
const result = await novaReelTool.execute({
  action: 'start',
  prompt: '美しい夕日が海に沈み、波が静かに浜辺に打ち寄せる様子',
  duration: 6,
  dimension: '1280x720',
});

console.log(result.invocationArn); // ジョブARN
console.log(result.estimatedTime); // 予想完了時間
```

### Image-to-Video生成

```typescript
// 画像から動画を生成
const result = await novaReelTool.execute({
  action: 'start',
  prompt: '花が風に揺れる様子をアニメーション化',
  imageBase64: 'iVBORw0KGgoAAAANSUhEUgAA...', // Base64エンコードされた画像
  duration: 6,
  dimension: '1280x720',
});
```

### ジョブステータスの確認

```typescript
// ステータスを確認
const statusResult = await novaReelTool.execute({
  action: 'status',
  invocationArn: 'arn:aws:bedrock:us-east-1:...',
});

console.log(statusResult.status); // InProgress, Completed, Failed
console.log(statusResult.progress); // 進捗率（%）
console.log(statusResult.s3Path); // 完了時のS3パス
```

### 完了まで待機

```typescript
// 完了まで待機（ポーリング）
const result = await novaReelTool.execute({
  action: 'start',
  prompt: '猫が毛糸のボールで遊ぶ様子',
  duration: 6,
  waitForCompletion: true,
  pollingInterval: 30, // 30秒ごとにチェック
  maxWaitTime: 300, // 最大5分待機
});

if (result.status === 'Completed') {
  console.log('動画生成完了:', result.s3Path);
}
```

### ジョブ一覧の取得

```typescript
// 完了したジョブの一覧を取得
const listResult = await novaReelTool.execute({
  action: 'list',
  statusFilter: 'Completed',
  maxResults: 5,
  sortOrder: 'Descending',
});

console.log(`${listResult.count}件のジョブが見つかりました`);
listResult.jobs.forEach((job) => {
  console.log(`ARN: ${job.invocationArn}`);
  console.log(`ステータス: ${job.status}`);
  console.log(`出力: ${job.outputS3Uri}`);
});
```

## パラメータリファレンス

### Start Action

| パラメータ | 型 | 必須 | デフォルト | 説明 |
|-----------|-----|------|-----------|------|
| `action` | `'start'` | ✓ | - | アクション種別 |
| `prompt` | `string` | ✓ | - | 動画生成のテキストプロンプト |
| `negativePrompt` | `string` | - | - | 生成から除外する要素 |
| `imageBase64` | `string` | - | - | Image-to-Video用の画像（Base64） |
| `imageS3Uri` | `string` | - | - | Image-to-Video用の画像（S3 URI） |
| `duration` | `6 \| 120` | - | `6` | 動画の長さ（秒） |
| `dimension` | `string` | - | `'1280x720'` | 解像度 |
| `fps` | `number` | - | `24` | フレームレート |
| `seed` | `number` | - | ランダム | シード値（0-2147483647） |
| `outputPath` | `string` | - | 自動生成 | 出力ファイル名 |
| `waitForCompletion` | `boolean` | - | `false` | 完了まで待機 |
| `pollingInterval` | `number` | - | `30` | ポーリング間隔（秒） |
| `maxWaitTime` | `number` | - | `1200` | 最大待機時間（秒） |

### Status Action

| パラメータ | 型 | 必須 | デフォルト | 説明 |
|-----------|-----|------|-----------|------|
| `action` | `'status'` | ✓ | - | アクション種別 |
| `invocationArn` | `string` | ✓ | - | ジョブのARN |
| `waitForCompletion` | `boolean` | - | `false` | 完了まで待機 |
| `pollingInterval` | `number` | - | `30` | ポーリング間隔（秒） |
| `maxWaitTime` | `number` | - | `1200` | 最大待機時間（秒） |

### List Action

| パラメータ | 型 | 必須 | デフォルト | 説明 |
|-----------|-----|------|-----------|------|
| `action` | `'list'` | ✓ | - | アクション種別 |
| `statusFilter` | `JobStatus` | - | - | ステータスフィルタ |
| `maxResults` | `number` | - | `10` | 最大取得件数 |
| `sortOrder` | `'Ascending' \| 'Descending'` | - | `'Descending'` | ソート順 |

### 解像度オプション

- `1280x720`: 横長動画（16:9、風景向き）
- `720x1280`: 縦長動画（9:16、ポートレート向き）
- `1280x1280`: 正方形動画（1:1、SNS向き）

## 使用例

### ユースケース1: Text-to-Video - 短い動画

```typescript
// 6秒の風景動画を生成
const result = await novaReelTool.execute({
  action: 'start',
  prompt: '満開の桜の木の下で、花びらが風に舞い散る美しい春の情景',
  duration: 6,
  dimension: '1280x720',
  seed: 12345, // 再現性のためのシード値
});

// 予想完了時間: 約90秒
console.log(`ジョブ開始: ${result.invocationArn}`);
console.log(`完了予定: ${result.estimatedTime}`);
```

### ユースケース2: Text-to-Video - 長い動画

```typescript
// 2分の動画を生成
const result = await novaReelTool.execute({
  action: 'start',
  prompt: '都会の街並みを空撮で捉え、日の出から日没まで時間の流れを表現',
  duration: 120,
  dimension: '1280x720',
});

// 予想完了時間: 約14-17分
console.log(`ジョブ開始: ${result.invocationArn}`);
```

### ユースケース3: Image-to-Video

```typescript
import fs from 'fs';

// 画像を読み込んでBase64エンコード
const imageBuffer = fs.readFileSync('./my-image.png');
const imageBase64 = imageBuffer.toString('base64');

// 画像から動画を生成
const result = await novaReelTool.execute({
  action: 'start',
  prompt: '静止画の建物に命を吹き込み、窓に明かりが灯り、煙突から煙が立ち上る',
  imageBase64,
  duration: 6,
  dimension: '1280x720',
});
```

### ユースケース4: ネガティブプロンプトの使用

```typescript
// 不要な要素を除外して生成
const result = await novaReelTool.execute({
  action: 'start',
  prompt: '森の中を流れる清らかな小川',
  negativePrompt: 'people, buildings, cars, text, watermark',
  duration: 6,
  dimension: '1280x720',
});
```

### ユースケース5: 非同期ジョブ管理

```typescript
// ジョブを開始（非同期）
const startResult = await novaReelTool.execute({
  action: 'start',
  prompt: '宇宙空間を漂う星雲の美しい景色',
  duration: 120,
});

const jobArn = startResult.invocationArn;

// 別のタスクを実行...

// 後でステータスを確認
const statusResult = await novaReelTool.execute({
  action: 'status',
  invocationArn: jobArn,
});

if (statusResult.status === 'Completed') {
  console.log('動画が完成しました:', statusResult.s3Path);
} else if (statusResult.status === 'InProgress') {
  console.log(`生成中... 進捗: ${statusResult.progress}%`);
}
```

### ユースケース6: ジョブ履歴の確認

```typescript
// 最近完了したジョブを取得
const completedJobs = await novaReelTool.execute({
  action: 'list',
  statusFilter: 'Completed',
  maxResults: 10,
  sortOrder: 'Descending',
});

console.log(`完了したジョブ: ${completedJobs.count}件`);
completedJobs.jobs.forEach((job, index) => {
  console.log(`\n[${index + 1}] ${job.invocationArn}`);
  console.log(`   提出日時: ${job.submitTime}`);
  console.log(`   完了日時: ${job.endTime}`);
  console.log(`   出力: ${job.outputS3Uri}`);
});
```

### ユースケース7: エラーハンドリング

```typescript
const result = await novaReelTool.execute({
  action: 'start',
  prompt: '宇宙船が惑星の大気圏に突入する迫力のシーン',
  duration: 6,
  waitForCompletion: true,
  maxWaitTime: 300,
});

if (!result.success) {
  console.error('エラーが発生しました:', result.message);
  
  if (result.status === 'Failed') {
    console.error('失敗理由:', result.failureMessage);
  }
} else if (result.status === 'Completed') {
  console.log('動画生成成功!');
  console.log('S3パス:', result.s3Path);
} else {
  console.log('タイムアウト: ジョブは継続中です');
  console.log('後でステータスを確認してください:', result.invocationArn);
}
```

## 技術的詳細

### アーキテクチャ

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       │ execute()
       │
┌──────▼────────────────────────────────┐
│      Nova Reel Tool                   │
│  ┌─────────┬──────────┬──────────┐   │
│  │ start   │ status   │ list     │   │
│  └────┬────┴────┬─────┴────┬─────┘   │
└───────┼─────────┼──────────┼─────────┘
        │         │          │
        │         │          │
┌───────▼─────────▼──────────▼─────────┐
│   AWS Bedrock Runtime (us-east-1)    │
│   - StartAsyncInvokeCommand          │
│   - GetAsyncInvokeCommand            │
│   - ListAsyncInvokesCommand          │
└───────┬──────────────────────────────┘
        │
        │ Async Job
        │
┌───────▼──────────────────────────────┐
│   Amazon Nova Reel v1:1              │
│   - Text-to-Video                    │
│   - Image-to-Video                   │
└───────┬──────────────────────────────┘
        │
        │ Output
        │
┌───────▼──────────────────────────────┐
│   Amazon S3                          │
│   - Temp output location             │
│   - User storage                     │
└──────────────────────────────────────┘
```

### モデル情報

- **モデルID**: `amazon.nova-reel-v1:1`
- **リージョン**: `us-east-1`
- **処理方式**: 非同期（Async Invoke）

### 生成時間の目安

| 動画の長さ | 生成時間 |
|-----------|----------|
| 6秒 | 約90秒 |
| 120秒 | 約14-17分 |

### S3ストレージ

生成された動画は以下の構造でS3に保存されます：

```
s3://{bucket}/users/{userId}/{storagePath}/videos/{filename}.mp4
```

- 一時出力先: `s3://{bucket}/temp/nova-reel/{userId}/{timestamp}/`
- 最終保存先: `s3://{bucket}/users/{userId}/{storagePath}/videos/`

### 制約事項

1. **モデル制限**:
   - 動画の長さは6秒または120秒のみサポート
   - 解像度は3種類（1280x720、720x1280、1280x1280）
   - フレームレートは24fps

2. **API制限**:
   - 非同期処理のため、結果の即時取得は不可
   - リージョンは`us-east-1`固定

3. **コスト**:
   - 6秒動画と120秒動画で課金が異なります
   - 詳細はAWS Bedrock料金ページを参照

4. **画像入力**:
   - Image-to-VideoではBase64エンコードまたはS3 URIをサポート
   - 対応フォーマット: PNG, JPEG, GIF, WebP

### 環境変数

以下の環境変数が必要です：

```bash
# S3バケット名（動画保存用）
USER_STORAGE_BUCKET_NAME=your-bucket-name

# AWSリージョン
AWS_REGION=us-east-1

# AWS認証情報（自動設定される場合あり）
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

## トラブルシューティング

### よくある問題と解決方法

#### 1. "USER_STORAGE_BUCKET_NAME is not configured"

**原因**: S3バケット名が設定されていません。

**解決方法**:
```bash
export USER_STORAGE_BUCKET_NAME=your-bucket-name
```

#### 2. "Video generation failed"

**原因**: プロンプトが不適切、またはモデル側のエラー。

**解決方法**:
- プロンプトを具体的で明確な内容に修正
- `negativePrompt`を使用して不要な要素を除外
- `failureMessage`を確認してエラー詳細を確認

```typescript
const statusResult = await novaReelTool.execute({
  action: 'status',
  invocationArn: 'arn:aws:...',
});

if (statusResult.status === 'Failed') {
  console.log('エラー詳細:', statusResult.failureMessage);
}
```

#### 3. "Maximum wait time exceeded"

**原因**: 完了待機時間が設定値を超過。

**解決方法**:
- `maxWaitTime`を延長（特に120秒動画の場合）
- `waitForCompletion: false`にして非同期で処理

```typescript
const result = await novaReelTool.execute({
  action: 'start',
  prompt: '長い動画プロンプト',
  duration: 120,
  waitForCompletion: true,
  maxWaitTime: 1800, // 30分に延長
});
```

#### 4. "Source video not found"

**原因**: Nova Reelの出力先が見つからない。

**解決方法**:
- ジョブのステータスが`Completed`になっているか確認
- `outputS3Uri`が正しく設定されているか確認

#### 5. 画像フォーマットエラー

**原因**: 対応していない画像フォーマット。

**解決方法**:
対応フォーマット（PNG、JPEG、GIF、WebP）を使用してください。

```typescript
// 画像をPNGに変換してからBase64エンコード
import sharp from 'sharp';

const imageBuffer = await sharp('input.jpg')
  .png()
  .toBuffer();
const imageBase64 = imageBuffer.toString('base64');
```

#### 6. ジョブが見つからない

**原因**: `invocationArn`が無効、または古いジョブが削除された。

**解決方法**:
- ARNが正しいか確認
- `list`アクションで有効なジョブを確認

```typescript
const listResult = await novaReelTool.execute({
  action: 'list',
  maxResults: 20,
});

console.log('有効なジョブ一覧:');
listResult.jobs.forEach(job => {
  console.log(`- ${job.invocationArn} (${job.status})`);
});
```

### デバッグ方法

ログレベルを設定してデバッグ情報を確認：

```typescript
// ログレベルをdebugに設定
process.env.LOG_LEVEL = 'debug';

const result = await novaReelTool.execute({
  action: 'start',
  prompt: 'テストプロンプト',
});

// ログ出力例:
// [NOVA_REEL] Starting video generation for user: user123
// [NOVA_REEL] Parameters: prompt="テストプロンプト", duration=6s, dimension=1280x720
// [NOVA_REEL] Video generation started: arn:aws:bedrock:...
```

### サポートリソース

- [Amazon Bedrock ドキュメント](https://docs.aws.amazon.com/bedrock/)
- [Amazon Nova Reel 公式ページ](https://aws.amazon.com/bedrock/nova/)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)

## ベストプラクティス

### 1. 効果的なプロンプトの書き方

```typescript
// ✅ 良い例: 具体的で詳細
const result = await novaReelTool.execute({
  action: 'start',
  prompt: '黄金色の夕日が地平線に沈み、オレンジ色の空の下で静かな湖面に波紋が広がる、穏やかな自然の風景',
  duration: 6,
});

// ❌ 悪い例: 曖昧で短い
const result = await novaReelTool.execute({
  action: 'start',
  prompt: '夕日',
  duration: 6,
});
```

### 2. ネガティブプロンプトの活用

```typescript
const result = await novaReelTool.execute({
  action: 'start',
  prompt: '自然の中の滝',
  negativePrompt: 'people, text, watermark, logos, blurry, low quality',
  duration: 6,
});
```

### 3. シード値で再現性を確保

```typescript
// 同じシード値を使うと同じ動画が生成される
const seed = 42;

const result1 = await novaReelTool.execute({
  action: 'start',
  prompt: '流れ星',
  seed,
});

// 後日同じシードで再生成
const result2 = await novaReelTool.execute({
  action: 'start',
  prompt: '流れ星',
  seed, // 同じシード値
});
```

### 4. 非同期処理の活用

```typescript
// 複数の動画を並行生成
const prompts = [
  '朝の森',
  '昼の海',
  '夜の都会',
];

const jobs = await Promise.all(
  prompts.map(prompt =>
    novaReelTool.execute({
      action: 'start',
      prompt,
      duration: 6,
    })
  )
);

console.log(`${jobs.length}個のジョブを開始しました`);

// 後でステータスをチェック
const statuses = await Promise.all(
  jobs.map(job =>
    novaReelTool.execute({
      action: 'status',
      invocationArn: job.invocationArn,
    })
  )
);
```

### 5. エラーハンドリングとリトライ

```typescript
async function generateVideoWithRetry(
  prompt: string,
  maxRetries = 3
): Promise<StartVideoOutput> {
  for (let i = 0; i < maxRetries; i++) {
    const result = await novaReelTool.execute({
      action: 'start',
      prompt,
      duration: 6,
      waitForCompletion: true,
      maxWaitTime: 300,
    });

    if (result.success && result.status === 'Completed') {
      return result;
    }

    if (result.status === 'Failed') {
      console.log(`試行 ${i + 1}/${maxRetries} 失敗: ${result.message}`);
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5秒待機
      }
    }
  }

  throw new Error('動画生成に失敗しました');
}
```

---

## まとめ

Amazon Nova Reelツールを使用すると、テキストプロンプトから簡単に高品質な動画を生成できます。非同期ジョブ管理機能により、長時間の動画生成も効率的に扱えます。

主なポイント：
- **3つのアクション**: start（開始）、status（確認）、list（一覧）
- **2つの生成モード**: Text-to-VideoとImage-to-Video
- **柔軟な設定**: 動画の長さ、解像度、シード値などをカスタマイズ可能
- **自動S3保存**: 生成された動画は自動的にS3に保存

詳細な使用例とベストプラクティスを参照して、効果的に動画生成を行ってください。
