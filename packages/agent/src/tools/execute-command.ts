/**
 * コマンド実行ツール - シェルコマンドを安全に実行
 */

import { tool } from '@strands-agents/sdk';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../config/index.js';

const execAsync = promisify(exec);

/**
 * exec実行時のエラー型定義
 */
interface ExecError extends Error {
  code?: number;
  signal?: string;
  stdout?: string;
  stderr?: string;
}

/**
 * 危険なコマンドのブラックリスト
 */
const DANGEROUS_COMMANDS = [
  // システム破壊系
  'rm -rf /',
  'mkfs',
  'dd if=',
  'fdisk',

  // システム操作系
  'shutdown',
  'reboot',
  'halt',
  'init 0',
  'init 6',
];

/**
 * 許可された作業ディレクトリかチェック
 */
function isAllowedWorkingDirectory(dir: string): boolean {
  // ルートディレクトリは禁止
  if (dir === '/') {
    return false;
  }

  // 環境変数で許可ディレクトリが指定されている場合はチェック
  const allowedDirs = process.env.ALLOWED_WORKING_DIRS?.split(',') || [];
  if (allowedDirs.length > 0) {
    return allowedDirs.some((allowed) => dir.startsWith(allowed.trim()));
  }

  // デフォルトでは/home、/tmp、/var/tmp、/Users以下は許可
  const defaultAllowed = ['/home/', '/tmp/', '/var/tmp/', '/Users/'];
  return defaultAllowed.some((allowed) => dir.startsWith(allowed));
}

/**
 * 危険なコマンドかチェック
 */
function isDangerousCommand(command: string): boolean {
  const lowerCommand = command.toLowerCase().trim();

  return DANGEROUS_COMMANDS.some((dangerous) => lowerCommand.includes(dangerous.toLowerCase()));
}

/**
 * 出力を安全なサイズに切り詰め
 */
function truncateOutput(output: string, maxLength: number = 4000): string {
  if (output.length <= maxLength) {
    return output;
  }

  const truncated = output.substring(0, maxLength);
  return `${truncated}\n\n... (出力が長すぎるため切り詰められました。元の長さ: ${output.length}文字)`;
}

/**
 * コマンド実行ツール
 */
export const executeCommandTool = tool({
  name: 'execute_command',
  description:
    'シェルコマンドを実行し、結果を返します。ファイル操作、情報収集、開発タスクの自動化に使用できます。',
  inputSchema: z.object({
    command: z.string().describe('実行するシェルコマンド'),
    workingDirectory: z
      .string()
      .optional()
      .describe('作業ディレクトリ（未指定の場合は現在のディレクトリ）'),
    timeout: z
      .number()
      .min(1000)
      .max(60000)
      .default(30000)
      .describe('タイムアウト（ミリ秒、デフォルト: 30秒、最大: 60秒）'),
  }),
  callback: async (input) => {
    const { command, workingDirectory, timeout } = input;

    logger.info(`🔧 コマンド実行開始: ${command}`);

    try {
      // 1. セキュリティチェック: 危険なコマンドの検出
      if (isDangerousCommand(command)) {
        const errorMsg = `⚠️ セキュリティエラー: 危険なコマンドが検出されました\nコマンド: ${command}`;
        logger.warn(errorMsg);
        return errorMsg;
      }

      // 2. 作業ディレクトリのチェック
      if (workingDirectory && !isAllowedWorkingDirectory(workingDirectory)) {
        const errorMsg = `⚠️ セキュリティエラー: 許可されていない作業ディレクトリです\nディレクトリ: ${workingDirectory}`;
        logger.warn(errorMsg);
        return errorMsg;
      }

      // 3. コマンド実行
      const execOptions = {
        timeout,
        maxBuffer: 1024 * 1024 * 10, // 10MB
        cwd: workingDirectory,
        encoding: 'utf8' as const,
      };

      const startTime = Date.now();
      const result = await execAsync(command, execOptions);
      const duration = Date.now() - startTime;

      // 4. 結果の整形
      const stdout = truncateOutput(result.stdout || '');
      const stderr = truncateOutput(result.stderr || '');

      const output = `実行結果:
コマンド: ${command}
作業ディレクトリ: ${workingDirectory || '(現在のディレクトリ)'}
実行時間: ${duration}ms
終了コード: 0

標準出力:
${stdout || '(出力なし)'}

${stderr ? `標準エラー:\n${stderr}` : ''}`.trim();

      logger.info(`✅ コマンド実行成功: ${command} (${duration}ms)`);
      return output;
    } catch (error: unknown) {
      // エラーハンドリング
      const execError = error as ExecError;
      let errorOutput = `実行エラー:
コマンド: ${command}
作業ディレクトリ: ${workingDirectory || '(現在のディレクトリ)'}
`;

      if (execError.code !== undefined) {
        errorOutput += `終了コード: ${execError.code}\n`;
      }

      if (execError.signal) {
        errorOutput += `シグナル: ${execError.signal}\n`;
      }

      if (execError.stdout) {
        errorOutput += `\n標準出力:\n${truncateOutput(execError.stdout)}`;
      }

      if (execError.stderr) {
        errorOutput += `\n標準エラー:\n${truncateOutput(execError.stderr)}`;
      }

      // タイムアウトエラーの特別処理
      const isTimeout =
        execError.signal === 'SIGTERM' ||
        execError.message?.includes('timeout') ||
        execError.message?.includes('ETIMEDOUT');
      if (isTimeout) {
        errorOutput += `\n⏰ タイムアウト: ${timeout}ms で実行が中断されました`;
      }

      logger.error(`❌ コマンド実行エラー: ${command}`, execError.message || 'Unknown error');
      return errorOutput;
    }
  },
});
