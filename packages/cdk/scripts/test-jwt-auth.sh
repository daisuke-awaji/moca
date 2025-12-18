#!/bin/bash

# JWT認証テスト用スクリプト
# AgentCore Runtime の JWT 認証機能をテストします

set -e

# 設定
USER_POOL_ID="us-east-1_OZ6KUvSn3"
CLIENT_ID="19duob1sqr877jesho69aildbn"
REGION="us-east-1"
TEST_USERNAME="testuser"
TEST_PASSWORD="TestPassword123!"

# Runtime情報を取得
echo "🔍 AgentCore Runtime情報を取得中..."
RUNTIME_ARN=$(aws cloudformation describe-stacks \
  --stack-name AgentCoreStack \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`AgentRuntimeArn`].OutputValue' \
  --output text 2>/dev/null || echo "")

if [ -z "$RUNTIME_ARN" ]; then
  echo "⚠️  Runtime ARNが見つかりません。既存のGatewayでテストします。"
  RUNTIME_ENDPOINT="https://default-gateway-0wpcw3peau.gateway.bedrock-agentcore.us-east-1.amazonaws.com/mcp"
else
  # Runtime ARN を URL エンコード（重要！）
  ESCAPED_RUNTIME_ARN=$(printf '%s' "$RUNTIME_ARN" | jq -sRr @uri)
  RUNTIME_ENDPOINT="https://bedrock-agentcore.us-east-1.amazonaws.com/runtimes/$ESCAPED_RUNTIME_ARN/invocations?qualifier=DEFAULT"
  echo "✅ Runtime ARN: $RUNTIME_ARN"
  echo "🔗 URL Encoded ARN: $ESCAPED_RUNTIME_ARN"
fi

echo "🎯 テストエンドポイント: $RUNTIME_ENDPOINT"

# 1. テストユーザー作成
echo ""
echo "👤 テストユーザーを作成中..."
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username $TEST_USERNAME \
  --message-action SUPPRESS \
  --region $REGION \
  --temporary-password "TempPass123!" > /dev/null 2>&1 || echo "ℹ️  ユーザーが既に存在します"

# パスワードを永続化
echo "🔑 パスワードを設定中..."
aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username $TEST_USERNAME \
  --password $TEST_PASSWORD \
  --permanent \
  --region $REGION

echo "✅ テストユーザー '$TEST_USERNAME' 作成完了"

# 2. JWT Token取得
echo ""
echo "🎫 JWT Tokenを取得中..."
AUTH_RESPONSE=$(aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id $CLIENT_ID \
  --auth-parameters USERNAME=$TEST_USERNAME,PASSWORD=$TEST_PASSWORD \
  --region $REGION)

JWT_TOKEN=$(echo $AUTH_RESPONSE | jq -r '.AuthenticationResult.AccessToken')

if [ "$JWT_TOKEN" = "null" ] || [ -z "$JWT_TOKEN" ]; then
  echo "❌ JWT Token 取得に失敗しました"
  echo "Response: $AUTH_RESPONSE"
  exit 1
fi

echo "✅ JWT Token取得成功"
echo "Token (最初の50文字): ${JWT_TOKEN:0:50}..."

# Token詳細表示
echo ""
echo "📋 JWT Token詳細:"
echo "発行者: $(echo $AUTH_RESPONSE | jq -r '.AuthenticationResult.IdToken' | cut -d'.' -f2 | base64 -d 2>/dev/null | jq -r '.iss' 2>/dev/null || echo 'N/A')"
echo "有効期限: $(echo $AUTH_RESPONSE | jq -r '.AuthenticationResult.ExpiresIn')秒"
echo "トークンタイプ: $(echo $AUTH_RESPONSE | jq -r '.AuthenticationResult.TokenType')"

# 3. Runtime 呼び出しテスト
echo ""
echo "🚀 AgentCore Runtime 呼び出しテスト..."

# MCP Gateway テスト
echo ""
echo "📡 Gateway MCP エンドポイント テスト:"
GATEWAY_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -X POST \
  "https://default-gateway-0wpcw3peau.gateway.bedrock-agentcore.us-east-1.amazonaws.com/mcp" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' 2>/dev/null || echo -e "connection_error\n000")

HTTP_STATUS=$(echo "$GATEWAY_RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$GATEWAY_RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_STATUS"
if [ "$HTTP_STATUS" = "200" ]; then
  echo "✅ Gateway JWT認証成功!"
  echo "レスポンス: $(echo $RESPONSE_BODY | jq '.result.tools[].name' 2>/dev/null | head -3 | tr '\n' ' ' || echo $RESPONSE_BODY | head -c 100)"
elif [ "$HTTP_STATUS" = "401" ]; then
  echo "❌ JWT認証失敗 (401 Unauthorized)"
  echo "レスポンス: $RESPONSE_BODY"
elif [ "$HTTP_STATUS" = "403" ]; then
  echo "❌ 認証は成功したが、アクセス拒否 (403 Forbidden)"
  echo "レスポンス: $RESPONSE_BODY"
else
  echo "⚠️  予期しないレスポンス (HTTP $HTTP_STATUS)"
  echo "レスポンス: $RESPONSE_BODY"
fi

# Runtime エンドポイント テスト（利用可能な場合）
if [ ! -z "$RUNTIME_ARN" ]; then
  echo ""
  echo "🎯 Runtime直接呼び出しテスト (Bearer Token):"
  echo "エンドポイント: $RUNTIME_ENDPOINT"
  
  # セッションIDを生成（33文字以上必須）
  SESSION_ID="test-session-$(date +%s)-$(openssl rand -hex 8)"
  
  RUNTIME_RESPONSE=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -H "Content-Type: application/json" \
    -H "X-Amzn-Trace-Id: test-trace-$(date +%s)" \
    -H "X-Amzn-Bedrock-AgentCore-Runtime-Session-Id: $SESSION_ID" \
    -X POST \
    "$RUNTIME_ENDPOINT" \
    -d '{"prompt": "Hello, what is 1+1?"}' 2>/dev/null || echo -e "connection_error\n000")

  RUNTIME_HTTP_STATUS=$(echo "$RUNTIME_RESPONSE" | tail -n1)
  RUNTIME_RESPONSE_BODY=$(echo "$RUNTIME_RESPONSE" | sed '$d')

  echo "HTTP Status: $RUNTIME_HTTP_STATUS"
  if [ "$RUNTIME_HTTP_STATUS" = "200" ]; then
    echo "✅ Runtime JWT認証成功!"
    echo "レスポンス: $(echo $RUNTIME_RESPONSE_BODY | head -c 300)..."
  elif [ "$RUNTIME_HTTP_STATUS" = "401" ]; then
    echo "❌ JWT認証失敗 (401 Unauthorized)"
    echo "レスポンス: $RUNTIME_RESPONSE_BODY"
  elif [ "$RUNTIME_HTTP_STATUS" = "404" ]; then
    echo "❌ エンドポイントが見つかりません (404 Not Found)"
    echo "レスポンス: $RUNTIME_RESPONSE_BODY"
  else
    echo "⚠️  Runtime テスト結果 (HTTP $RUNTIME_HTTP_STATUS)"
    echo "レスポンス: $RUNTIME_RESPONSE_BODY"
  fi
fi

# 4. 認証情報サマリー
echo ""
echo "📊 JWT認証テスト サマリー:"
echo "User Pool ID: $USER_POOL_ID"
echo "Client ID: $CLIENT_ID"
echo "Test User: $TEST_USERNAME"
echo "Discovery URL: https://cognito-idp.$REGION.amazonaws.com/$USER_POOL_ID/.well-known/openid-configuration"
echo ""
echo "🎉 JWT認証テスト完了!"
