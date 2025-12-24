# @fullstack-agentcore/shared

共通型定義とツール名定数を提供するパッケージ

## 概要

このパッケージは、fullstack-agentcore プロジェクト全体で使用される共通の型定義と定数を提供します。特に、ローカルツール名の一元管理により、型安全性を向上させ、バグの温床となる文字列リテラルの散在を防ぎます。

## インストール

```bash
npm install @fullstack-agentcore/shared
```

## 使用方法

### ローカルツール名の使用

```typescript
import { LOCAL_TOOL_NAMES, S3_TOOL_NAMES } from '@fullstack-agentcore/shared';

// ツール名の参照
const toolName = LOCAL_TOOL_NAMES.S3_UPLOAD_FILE; // 's3_upload_file'

// S3関連ツールのチェック
const isS3Tool = S3_TOOL_NAMES.includes(toolName);
```

### 型の使用

```typescript
import { LocalToolName, S3ToolName } from '@fullstack-agentcore/shared';

// 型安全なツール名
function processTool(name: LocalToolName) {
  // ...
}

// S3ツールのみを受け付ける関数
function processS3Tool(name: S3ToolName) {
  // ...
}
```

### ヘルパー関数の使用

```typescript
import { 
  isLocalToolName, 
  isS3ToolName, 
  isTavilyToolName 
} from '@fullstack-agentcore/shared';

// ツール名の検証
if (isLocalToolName(unknownToolName)) {
  // unknownToolName は LocalToolName 型として扱える
}

if (isS3ToolName(toolName)) {
  // S3関連の処理
}
```

## 提供される定数・型

### 定数

- `LOCAL_TOOL_NAMES`: すべてのローカルツール名の定数オブジェクト
- `S3_TOOL_NAMES`: S3関連ツール名の配列
- `TAVILY_TOOL_NAMES`: Tavily関連ツール名の配列
- `ALL_LOCAL_TOOL_NAMES`: すべてのローカルツール名の配列

### 型

- `LocalToolName`: ローカルツール名の Union 型
- `S3ToolName`: S3ツール名の Union 型
- `TavilyToolName`: Tavilyツール名の Union 型

### ヘルパー関数

- `isLocalToolName(name: string): name is LocalToolName`
- `isS3ToolName(name: string): name is S3ToolName`
- `isTavilyToolName(name: string): name is TavilyToolName`

## 新しいツールの追加方法

1. `packages/shared/src/tools/local-tool-names.ts` を編集
2. `LOCAL_TOOL_NAMES` オブジェクトに新しいツール名を追加

```typescript
export const LOCAL_TOOL_NAMES = {
  // 既存のツール...
  
  // 新しいツールを追加
  NEW_TOOL: 'new_tool',
} as const;
```

3. 必要に応じて、カテゴリ別の配列にも追加

```typescript
export const NEW_CATEGORY_TOOL_NAMES = [
  LOCAL_TOOL_NAMES.NEW_TOOL,
  // ...
] as const;
```

4. shared パッケージをビルド

```bash
cd packages/shared
npm run build
```

5. 各パッケージで新しいツール名を使用

```typescript
import { LOCAL_TOOL_NAMES } from '@fullstack-agentcore/shared';

const toolDefinition = {
  name: LOCAL_TOOL_NAMES.NEW_TOOL,
  // ...
};
```

## 利点

### 型安全性の向上

- TypeScript の型チェックにより、存在しないツール名の使用を防止
- IDE の自動補完機能により、入力ミスを削減

### 保守性の向上

- ツール名の一元管理により、変更時の影響範囲を最小化
- grep や検索で、ツール名の使用箇所を容易に特定

### バグの削減

- 文字列リテラルの typo による実行時エラーを防止
- 新規ツール追加時の漏れを防止

## ビルド

```bash
npm run build
```

## クリーン

```bash
npm run clean
```

## ライセンス

MIT
