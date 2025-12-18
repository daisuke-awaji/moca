# AgentCore JWT 認証テストスクリプト

## 概要

AgentCore Runtime の JWT 認証機能をテストするためのスクリプトです。

## 使用方法

```bash
# 実行権限を付与（初回のみ）
chmod +x packages/cdk/scripts/test-jwt-auth.sh

# テスト実行
cd packages/cdk && ./scripts/test-jwt-auth.sh
```

## テスト内容

### 1. 🔧 環境準備

- Cognito User Pool と App Client の確認
- AgentCore Runtime ARN の取得

### 2. 👤 テストユーザー作成

- ユーザー名: `testuser`
- パスワード: `TestPassword123!`
- Cognito User Pool への登録

### 3. 🎫 JWT Token 取得

- USER_PASSWORD_AUTH フローでの認証
- Access Token の取得・検証

### 4. 🚀 エンドポイント テスト

- **Gateway MCP エンドポイント**: JWT Bearer Token による認証テスト
- **Runtime 直接呼び出し**: Runtime エンドポイントでの認証テスト

## 期待される結果

### ✅ 成功パターン

```
✅ Gateway JWT認証成功!
レスポンス: "echo-tool___echo" "echo-tool___ping" "x_amz_bedrock_agentcore_search"
```

### 🔧 設定項目

スクリプト内で設定可能な変数:

```bash
USER_POOL_ID="us-east-1_OZ6KUvSn3"          # Cognito User Pool ID
CLIENT_ID="19duob1sqr877jesho69aildbn"       # App Client ID
REGION="us-east-1"                           # AWS リージョン
TEST_USERNAME="testuser"                     # テストユーザー名
TEST_PASSWORD="TestPassword123!"             # テストパスワード
```

## トラブルシューティング

### JWT Token 取得失敗

- User Pool ID と Client ID が正しいか確認
- ユーザーが有効化されているか確認
- パスワードポリシーに準拠しているか確認

### 401 Unauthorized エラー

- JWT Token の有効期限確認（デフォルト：3600 秒）
- Cognito の Discovery URL 設定確認
- AllowedClients 設定確認

### 403 Forbidden エラー

- JWT Token の client_id claim 確認
- AgentCore の AuthorizerConfiguration 設定確認

### 404 Not Found エラー (Runtime 直接呼び出し)

- Runtime がデプロイされているか確認
- Runtime ARN が正しいか確認
- エンドポイント URL 形式確認

## JWT Token 詳細確認

取得した JWT Token の詳細は[jwt.io](https://jwt.io/)で確認可能:

```bash
# Access Token をコピーしてjwt.ioでデコード
echo $JWT_TOKEN
```

## 認証フロー図

```
[Client] → [Cognito User Pool] → [JWT Token] → [AgentCore Gateway/Runtime]
    ↓              ↓                   ↓               ↓
  testuser   USER_PASSWORD_AUTH   Bearer Token    JWT Authorizer
                                                (usingCognito)
```

## 関連リソース

- **User Pool**: `us-east-1_OZ6KUvSn3`
- **Client ID**: `19duob1sqr877jesho69aildbn`
- **Discovery URL**: `https://cognito-idp.us-east-1.amazonaws.com/us-east-1_OZ6KUvSn3/.well-known/openid-configuration`
- **Gateway Endpoint**: `https://default-gateway-0wpcw3peau.gateway.bedrock-agentcore.us-east-1.amazonaws.com/mcp`
