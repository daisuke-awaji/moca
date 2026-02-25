/**
 * Jest テストセットアップファイル
 */

import { loadEnvFile } from '../utils/load-env.js';
import path from 'path';

// テスト用の環境変数を読み込み
loadEnvFile(path.resolve('.env'));

// テストタイムアウトを30秒に設定
jest.setTimeout(30000);
