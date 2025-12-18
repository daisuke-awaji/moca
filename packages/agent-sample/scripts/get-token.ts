#!/usr/bin/env tsx

/**
 * Cognitoトークン取得スクリプト
 *
 * 使用方法:
 *   npm run get-token
 *   pnpm get-token
 *
 * 出力:
 *   - Access Token
 *   - ID Token
 *   - 有効期限（秒）
 */

import { cognitoAuth } from "../src/auth/cognito.js";
import { config, logger, validateConfig } from "../src/config/index.js";

/**
 * メイン処理
 */
async function main(): Promise<void> {
  try {
    // 設定値検証
    validateConfig();

    logger.info("Cognitoトークン取得を開始します...");

    // 認証実行
    const authResult = await cognitoAuth.authenticate();

    logger.info("認証が完了しました");

    // 結果を出力
    console.log("\n=== Cognito認証トークン ===");
    console.log(`Access Token: ${authResult.accessToken}`);
    console.log(`ID Token: ${authResult.idToken}`);
    console.log(`Token Type: ${authResult.tokenType}`);
    console.log(`Expires In: ${authResult.expiresIn}秒`);

    // 有効期限の日時も表示
    const expiryDate = new Date(Date.now() + authResult.expiresIn * 1000);
    console.log(`Expires At: ${expiryDate.toISOString()}`);

    // 環境変数として使える形式でも出力
    console.log("\n=== 環境変数用 ===");
    console.log(`export ACCESS_TOKEN="${authResult.accessToken}"`);
    console.log(`export ID_TOKEN="${authResult.idToken}"`);

    // Authorization ヘッダー用の形式も出力
    console.log("\n=== Authorization ヘッダー用 ===");
    console.log(`Bearer ${authResult.accessToken}`);

    logger.info("トークン取得が完了しました");
  } catch (error) {
    logger.error("トークン取得に失敗しました:", error);

    if (error instanceof Error) {
      console.error(`\nエラー: ${error.message}`);

      // よくあるエラーのトラブルシューティング情報を表示
      if (error.message.includes("NotAuthorizedException")) {
        console.error("\n💡 トラブルシューティング:");
        console.error(
          "  - ユーザー名またはパスワードが正しいか確認してください"
        );
        console.error(
          "  - .envファイルのCOGNITO_USERNAMEとCOGNITO_PASSWORDを確認してください"
        );
      } else if (error.message.includes("UserNotFoundException")) {
        console.error("\n💡 トラブルシューティング:");
        console.error("  - ユーザーが存在しているか確認してください");
        console.error("  - ユーザープールIDが正しいか確認してください");
      } else if (error.message.includes("必要な環境変数")) {
        console.error("\n💡 トラブルシューティング:");
        console.error(
          "  - .envファイルが存在し、必要な値が設定されているか確認してください"
        );
        console.error("  - .env.exampleを参考にしてください");
      }
    }

    process.exit(1);
  }
}

/**
 * プロセス終了時の処理
 */
function handleExit(): void {
  logger.debug("プロセスを終了します");
}

// シグナルハンドラを設定
process.on("SIGINT", handleExit);
process.on("SIGTERM", handleExit);

// メイン処理を実行
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("予期しないエラーが発生しました:", error);
    process.exit(1);
  });
}

export { main };
