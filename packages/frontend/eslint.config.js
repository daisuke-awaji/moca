import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import i18next from 'eslint-plugin-i18next';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      i18next,
    },
    rules: {
      'i18next/no-literal-string': [
        'warn',
        {
          mode: 'jsx-text-only',
          'jsx-attributes': {
            include: ['title', 'aria-label', 'alt', 'placeholder', 'label'],
          },
          words: {
            exclude: [
              // 数字のみ
              /^\d+$/,
              // CSS クラス名やIDなど
              /^[a-z]+(-[a-z]+)*$/,
              // URL
              /^https?:\/\//,
              // ファイルパス
              /^[./]/,
              // 特殊文字のみ
              /^[^\w\s]+$/,
              // 単一の大文字定数
              /^[A-Z_]+$/,
            ],
          },
          'should-validate-template': true,
          // テストファイルは除外
          ignoreAttribute: ['data-testid', 'data-*'],
        },
      ],
    },
  },
]);
