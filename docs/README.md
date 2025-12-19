# AgentCore ドキュメント

## 📚 ドキュメント一覧

### [AWS クラウドアーキテクチャ](./aws-architecture.md)

AWS デプロイ時の詳細なアーキテクチャとクラウドリソースの構成について

**内容:**
- 🏗️ AWS デプロイ構成図 (Mermaid)
- 🔗 AWS リソース詳細 (AgentCore Runtime, Gateway, Cognito等)
- 📊 監視・運用 (CloudWatch, ログ確認)
- 🔒 セキュリティ設計 (IAM ロール等)
- 🎯 実装ハイライト

### [JWT 認証システム](./jwt-authentication.md)

JWT 認証の詳細フローと実装について

**内容:**
- 🔐 JWT 認証フロー (Mermaid シーケンス図)
- 🔑 JWT 認証ヘッダー転送機能
- 📋 認証設定 (Cognito User Pool, JWT Claims)
- 🧪 JWT 伝播テスト
- 🔧 実装詳細 (AsyncLocalStorage, MCP等)
- 🛡️ セキュリティ考慮事項

## 🎯 ドキュメントの使い分け

| 用途 | 対象ドキュメント |
|------|------------------|
| **ローカル開発を始める** | [../README.md](../README.md) |
| **AWS デプロイについて知りたい** | [aws-architecture.md](./aws-architecture.md) |
| **JWT 認証の仕組みを理解したい** | [jwt-authentication.md](./jwt-authentication.md) |
| **API 仕様を確認したい** | [../openapi.yaml](../openapi.yaml) |

---

## 📖 関連リソース

- [AWS Bedrock AgentCore Documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/agents-runtime.html)
- [Strands Agents SDK](https://docs.strands-ai.com/)
- [Amazon Cognito JWT Tokens](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-with-identity-providers.html)
