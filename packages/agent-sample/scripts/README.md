# Cognito Token 取得スクリプト

このスクリプトは、`.env`ファイルに設定された Cognito 認証情報を使用して、Access Token と ID Token を取得するためのユーティリティです。

## 使用方法

```bash
# npm を使用する場合
npm run get-token

# pnpm を使用する場合
pnpm get-token

# yarn を使用する場合
yarn get-token
```

## 前提条件

1. `.env`ファイルが正しく設定されていること
2. 以下の環境変数が設定されていること：
   - `COGNITO_USER_POOL_ID`: Cognito ユーザープール ID
   - `COGNITO_CLIENT_ID`: Cognito クライアント（アプリケーション）ID
   - `COGNITO_USERNAME`: 認証用ユーザー名
   - `COGNITO_PASSWORD`: 認証用パスワード
   - `AWS_REGION`: AWS リージョン（デフォルト: us-east-1）

## 出力内容

スクリプトは以下の情報を出力します：

### 認証トークン情報

- **Access Token**: API 認証用のアクセストークン
- **ID Token**: ユーザー識別用の ID トークン
- **Token Type**: トークンタイプ（通常は "Bearer"）
- **Expires In**: 有効期限（秒）
- **Expires At**: 有効期限の日時（ISO 8601 形式）

### 環境変数用フォーマット

シェルで使用できる環境変数の形式でも出力されます：

```bash
export ACCESS_TOKEN="..."
export ID_TOKEN="..."
```

### Authorization ヘッダー用フォーマット

API リクエストの Authorization ヘッダーで直接使用できる形式でも出力されます：

```
Bearer eyJraWQiOiIyXC8zQWM4VDJJWVVBRjV2U0sySVl0eU4rWGZXRzJKc2pSaXhxNFE3c01RND0iLCJhbGciOiJSUzI1NiJ9...
```

## エラーハンドリング

スクリプトには以下のエラーに対するトラブルシューティング情報が含まれています：

### 認証エラー（NotAuthorizedException）

- ユーザー名またはパスワードが正しくない
- `.env`ファイルの`COGNITO_USERNAME`と`COGNITO_PASSWORD`を確認

### ユーザーが見つからないエラー（UserNotFoundException）

- 指定されたユーザーが存在しない
- ユーザープール ID が正しくない

### 環境変数エラー

- 必要な環境変数が設定されていない
- `.env.example`を参考に設定を確認

## トークンの使用例

取得したトークンは以下のように使用できます：

```bash
# トークンを環境変数にエクスポート
eval $(npm run get-token | grep "export")

# APIリクエストで使用
curl -H "Authorization: Bearer $ACCESS_TOKEN" \
     https://your-api-endpoint.com/api/resource
```

## ログレベル設定

`.env`ファイルの`LOG_LEVEL`設定でログの詳細度を調整できます：

- `debug`: 詳細なデバッグ情報を表示
- `info`: 一般的な情報を表示（デフォルト）
- `warn`: 警告メッセージのみ表示
- `error`: エラーメッセージのみ表示

## セキュリティに関する注意

- トークンは機密情報です。ログファイルやシェル履歴に残らないよう注意してください
- トークンには有効期限があります（通常 3600 秒 = 1 時間）
- 本スクリプトは開発・テスト環境での使用を想定しています

## ファイル構成

```
packages/agent-sample/
├── scripts/
│   ├── get-token.ts     # メインスクリプト
│   └── README.md        # このドキュメント
├── src/
│   ├── auth/
│   │   └── cognito.ts   # Cognito認証クライアント
│   └── config/
│       └── index.ts     # 設定管理
├── .env                 # 環境変数設定
└── package.json         # npm scripts定義
```
