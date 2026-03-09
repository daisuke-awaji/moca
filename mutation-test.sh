#!/bin/bash
# Mutation Testing Script
# Injects realistic bugs into source code and checks if tests catch them.
# Each mutation is applied, tests are run, and the result is recorded.
# The source is restored after each mutation.

set -e

REPO="/tmp/ws/development/moca"
RESULTS_FILE="$REPO/mutation-results.txt"
PASSED=0
SURVIVED=0
TOTAL=0

echo "=== Mutation Testing Report ===" > "$RESULTS_FILE"
echo "Date: $(date -u)" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

run_mutation() {
  local desc="$1"
  local file="$2"
  local original="$3"
  local mutant="$4"
  local test_cmd="$5"
  
  TOTAL=$((TOTAL + 1))
  
  # Apply mutation
  cd "$REPO"
  sed -i "s|$original|$mutant|" "$file"
  
  # Run tests (suppress output)
  if eval "$test_cmd" > /dev/null 2>&1; then
    # Tests still pass = mutation SURVIVED (test is weak!)
    SURVIVED=$((SURVIVED + 1))
    echo "❌ SURVIVED  M$TOTAL: $desc" >> "$RESULTS_FILE"
    echo "   File: $file" >> "$RESULTS_FILE"
    echo "   Mutation: $original → $mutant" >> "$RESULTS_FILE"
    echo "" >> "$RESULTS_FILE"
    echo "❌ SURVIVED  M$TOTAL: $desc"
  else
    # Tests failed = mutation KILLED (test works!)
    PASSED=$((PASSED + 1))
    echo "✅ KILLED    M$TOTAL: $desc" >> "$RESULTS_FILE"
    echo "" >> "$RESULTS_FILE"
    echo "✅ KILLED    M$TOTAL: $desc"
  fi
  
  # Restore original
  cd "$REPO"
  git checkout -- "$file"
}

echo "Starting mutation testing..."
echo ""

# ========================================================================
# Mutation Group 1: converters.ts
# ========================================================================
CONV_FILE="packages/agent/src/session/converters.ts"
CONV_TEST="cd $REPO/packages/agent && NODE_OPTIONS='--experimental-vm-modules --no-warnings' npx jest src/session/__tests__/converters.test.ts --silent"

# M1: Swap role mapping (user→ASSISTANT instead of USER)
run_mutation \
  "converters: role mapping user→ASSISTANT (should be USER)" \
  "$CONV_FILE" \
  "const agentCoreRole = message.role === 'user' ? 'USER' : 'ASSISTANT';" \
  "const agentCoreRole = message.role === 'user' ? 'ASSISTANT' : 'USER';" \
  "$CONV_TEST"

# M2: Remove the single-text-block optimization (always use blob)
run_mutation \
  "converters: skip conversational shortcut for single text block" \
  "$CONV_FILE" \
  "if (!hasNonTextContent && message.content.length === 1)" \
  "if (!hasNonTextContent && message.content.length === 0)" \
  "$CONV_TEST"

# M3: Wrong role conversion in agentCorePayloadToMessage (USER→assistant)
run_mutation \
  "converters: conversational USER→assistant (should be user)" \
  "$CONV_FILE" \
  "const strandsRole = payload.conversational.role === 'USER' ? 'user' : 'assistant';" \
  "const strandsRole = payload.conversational.role === 'USER' ? 'assistant' : 'user';" \
  "$CONV_TEST"

# M4: Use wrong encoding for blob (utf-16 instead of utf-8)
run_mutation \
  "converters: Buffer toString with wrong encoding" \
  "$CONV_FILE" \
  "const blobString = (payload.blob as Buffer).toString('utf8');" \
  "const blobString = (payload.blob as Buffer).toString('utf16le');" \
  "$CONV_TEST"

# M5: Break base64 decoding path
run_mutation \
  "converters: base64 decode with wrong encoding" \
  "$CONV_FILE" \
  "const decodedString = Buffer.from(payload.blob, 'base64').toString('utf8');" \
  "const decodedString = Buffer.from(payload.blob, 'hex').toString('utf8');" \
  "$CONV_TEST"

# M6: Break image format fallback (use 'jpeg' instead of 'png')
# Use a different approach since sed has trouble with the quotes
cd "$REPO"
TOTAL=$((TOTAL + 1))
cp "$CONV_FILE" "${CONV_FILE}.bak"
python3 -c "
import re
with open('$CONV_FILE', 'r') as f:
    content = f.read()
content = content.replace(\"|| 'png'\", \"|| 'jpeg'\", 1)
with open('$CONV_FILE', 'w') as f:
    f.write(content)
"
if eval "$CONV_TEST" > /dev/null 2>&1; then
  SURVIVED=$((SURVIVED + 1))
  echo "❌ SURVIVED  M$TOTAL: converters: wrong default image format" >> "$RESULTS_FILE"
  echo "   File: $CONV_FILE" >> "$RESULTS_FILE"
  echo "   Mutation: default format 'png' → 'jpeg'" >> "$RESULTS_FILE"
  echo "" >> "$RESULTS_FILE"
  echo "❌ SURVIVED  M$TOTAL: converters: wrong default image format"
else
  PASSED=$((PASSED + 1))
  echo "✅ KILLED    M$TOTAL: converters: wrong default image format" >> "$RESULTS_FILE"
  echo "" >> "$RESULTS_FILE"
  echo "✅ KILLED    M$TOTAL: converters: wrong default image format"
fi
git checkout -- "$CONV_FILE"

# M7: Skip legacy tool format check (messageType !== 'tool')
run_mutation \
  "converters: break legacy messageType=tool detection" \
  "$CONV_FILE" \
  "if (blobObj.messageType === 'tool')" \
  "if (blobObj.messageType === 'tool_BROKEN')" \
  "$CONV_TEST"

# M8: Return empty string instead of ' ' for empty content
run_mutation \
  "converters: empty content returns empty string instead of space" \
  "$CONV_FILE" \
  "content: { text: ' ' }, // Minimum 1 character" \
  "content: { text: '' }, // Minimum 1 character" \
  "$CONV_TEST"

# ========================================================================
# Mutation Group 2: zod-converter.ts
# ========================================================================
ZOD_FILE="packages/agent/src/schemas/zod-converter.ts"
ZOD_TEST="cd $REPO/packages/agent && NODE_OPTIONS='--experimental-vm-modules --no-warnings' npx jest src/schemas/__tests__/zod-converter.test.ts --silent"

# M9: Wrong truncation length (32 instead of 64)
run_mutation \
  "zod-converter: truncate at 32 instead of 64 chars" \
  "$ZOD_FILE" \
  "if (sanitized.length > 64)" \
  "if (sanitized.length > 32)" \
  "$ZOD_TEST"

# M10: Don't replace disallowed characters
run_mutation \
  "zod-converter: skip character sanitization regex" \
  "$ZOD_FILE" \
  "let sanitized = key.replace(/\[^a-zA-Z0-9_.-\]/g, '_');" \
  "let sanitized = key;" \
  "$ZOD_TEST"

# M11: Wrong fallback for empty sanitized key
run_mutation \
  "zod-converter: wrong fallback name for empty key" \
  "$ZOD_FILE" \
  "sanitized = '_param';" \
  "sanitized = '';" \
  "$ZOD_TEST"

# ========================================================================
# Mutation Group 3: scheduler-service.ts
# ========================================================================
SCHED_FILE="packages/backend/src/services/scheduler-service.ts"
SCHED_TEST="cd $REPO/packages/backend && npx jest src/services/__tests__/scheduler-service.test.ts --silent"

# M12: Don't wrap bare cron expressions
run_mutation \
  "scheduler: return raw expression without cron() wrapping" \
  "$SCHED_FILE" \
  "return \`cron(\${trimmed})\`;" \
  "return trimmed;" \
  "$SCHED_TEST"

# M13: Wrong rate expression parsing
run_mutation \
  "scheduler: wrong substring index for rate expression" \
  "$SCHED_FILE" \
  "return \`rate(\${trimmed.substring(5)})\`;" \
  "return \`rate(\${trimmed.substring(4)})\`;" \
  "$SCHED_TEST"

# ========================================================================
# Mutation Group 4: auth middleware
# ========================================================================
AUTH_FILE="packages/backend/src/middleware/auth.ts"
AUTH_TEST="cd $REPO/packages/backend && npx jest src/middleware/__tests__/auth.test.ts --silent"

# M14: Always return true for isMachineUser (security vulnerability!)
run_mutation \
  "auth: isMachineUserToken always returns true (SECURITY BUG)" \
  "$AUTH_FILE" \
  "return payload.token_use === 'access';" \
  "return true;" \
  "$AUTH_TEST"

# M15: Never detect machine user (always false)
run_mutation \
  "auth: isMachineUserToken always returns false" \
  "$AUTH_FILE" \
  "return payload.token_use === 'access';" \
  "return false;" \
  "$AUTH_TEST"

# ========================================================================
# Mutation Group 5: auth-resolver.ts
# ========================================================================
AUTHRES_FILE="packages/agent/src/handlers/auth-resolver.ts"
AUTHRES_TEST="cd $REPO/packages/agent && NODE_OPTIONS='--experimental-vm-modules --no-warnings' npx jest src/handlers/__tests__/auth-resolver-extended.test.ts --silent"

# M16: Accept any scope (remove scope check)
run_mutation \
  "auth-resolver: accept any scope (bypass validation)" \
  "$AUTHRES_FILE" \
  "if (!scopes.includes(REQUIRED_MACHINE_USER_SCOPE))" \
  "if (false)" \
  "$AUTHRES_TEST"

# M17: Accept invalid UUID format
run_mutation \
  "auth-resolver: UUID regex always matches" \
  "$AUTHRES_FILE" \
  "if (!uuidRegex.test(targetUserId))" \
  "if (false)" \
  "$AUTHRES_TEST"

# M18: Allow regular users to specify targetUserId (privilege escalation!)
run_mutation \
  "auth-resolver: allow targetUserId for regular users (PRIV ESCALATION)" \
  "$AUTHRES_FILE" \
  "if (targetUserId) {" \
  "if (false) {" \
  "$AUTHRES_TEST"

# ========================================================================
# Mutation Group 6: context-parser.ts
# ========================================================================
CTX_FILE="packages/lambda-tools/shared/src/context-parser.ts"
CTX_TEST="cd $REPO/packages/lambda-tools/shared && npx jest src/__tests__/context-parser.test.ts --silent"

# M19: Wrong delimiter for tool name extraction
run_mutation \
  "context-parser: use wrong delimiter '---' instead of '___'" \
  "$CTX_FILE" \
  "const delimiter = '___';" \
  "const delimiter = '---';" \
  "$CTX_TEST"

# M20: Return null instead of processed tool name
run_mutation \
  "context-parser: always return null from extractToolName" \
  "$CTX_FILE" \
  "return processedToolName;" \
  "return null;" \
  "$CTX_TEST"

# ========================================================================
# Mutation Group 7: tool-registry.ts
# ========================================================================
REG_FILE="packages/lambda-tools/shared/src/tool-registry.ts"
REG_TEST="cd $REPO/packages/lambda-tools/shared && npx jest src/__tests__/tool-registry.test.ts --silent"

# M21: getHandler returns default for ALL names (not just null/missing)
run_mutation \
  "tool-registry: getHandler always returns default handler" \
  "$REG_FILE" \
  "const tool = this.registry.get(toolName);" \
  "const tool = undefined;" \
  "$REG_TEST"

# M22: register doesn't check duplicates
run_mutation \
  "tool-registry: allow duplicate registration (no error)" \
  "$REG_FILE" \
  "if (this.registry.has(tool.name))" \
  "if (false)" \
  "$REG_TEST"

# ========================================================================
# Mutation Group 8: title-generator.ts
# ========================================================================
TITLE_FILE="packages/agent/src/services/title-generator.ts"
TITLE_TEST="cd $REPO/packages/agent && NODE_OPTIONS='--experimental-vm-modules --no-warnings' npx jest src/services/__tests__/title-generator.test.ts --silent"

# M23: Don't strip quotes from title
cd "$REPO"
TOTAL=$((TOTAL + 1))
python3 -c "
with open('$TITLE_FILE', 'r') as f:
    content = f.read()
content = content.replace(
    \"title = title.replace(/^[\\\"'\\u300C\\u300D\\u300E\\u300F\\u201C\\u201D\\u2018\\u2019]+|[\\\"'\\u300C\\u300D\\u300E\\u300F\\u201C\\u201D\\u2018\\u2019]+$/g, '');\",
    '// MUTATION: quote stripping disabled',
    1
)
with open('$TITLE_FILE', 'w') as f:
    f.write(content)
"
if eval "$TITLE_TEST" > /dev/null 2>&1; then
  SURVIVED=$((SURVIVED + 1))
  echo "❌ SURVIVED  M$TOTAL: title-generator: skip quote stripping" >> "$RESULTS_FILE"
  echo "   File: $TITLE_FILE" >> "$RESULTS_FILE"
  echo "" >> "$RESULTS_FILE"
  echo "❌ SURVIVED  M$TOTAL: title-generator: skip quote stripping"
else
  PASSED=$((PASSED + 1))
  echo "✅ KILLED    M$TOTAL: title-generator: skip quote stripping" >> "$RESULTS_FILE"
  echo "" >> "$RESULTS_FILE"
  echo "✅ KILLED    M$TOTAL: title-generator: skip quote stripping"
fi
git checkout -- "$TITLE_FILE"

# M24: Wrong truncation length (100 instead of 50)
run_mutation \
  "title-generator: wrong truncation threshold (100 instead of 50)" \
  "$TITLE_FILE" \
  "if (title.length > 50)" \
  "if (title.length > 100)" \
  "$TITLE_TEST"

# M25: Don't truncate user message in prompt (potential token overflow)
run_mutation \
  "title-generator: skip message truncation in buildPrompt" \
  "$TITLE_FILE" \
  "const truncatedUserMessage = userMessage.substring(0, 500);" \
  "const truncatedUserMessage = userMessage;" \
  "$TITLE_TEST"

# ========================================================================
# Mutation Group 9: display-path.ts
# ========================================================================
DISP_FILE="packages/agent/src/utils/display-path.ts"
DISP_TEST="cd $REPO/packages/agent && NODE_OPTIONS='--experimental-vm-modules --no-warnings' npx jest src/utils/__tests__/display-path.test.ts --silent"

# M26: Return '/' unconditionally
run_mutation \
  "display-path: always return '/' regardless of input" \
  "$DISP_FILE" \
  "return filePath.slice(WORKSPACE_DIRECTORY.length) || '/';" \
  "return '/';" \
  "$DISP_TEST"

# ========================================================================
# Mutation Group 10: todo helpers.ts
# ========================================================================
TODO_FILE="packages/agent/src/tools/todo/helpers.ts"
TODO_TEST="cd $REPO/packages/agent && NODE_OPTIONS='--experimental-vm-modules --no-warnings' npx jest src/tools/todo/__tests__/helpers.test.ts --silent"

# M27: Wrong markdown format (missing status)
run_mutation \
  "todo-helpers: missing status in markdown format" \
  "$TODO_FILE" \
  "markdown += \`- id:\${item.id} (\${item.status}) \${item.description}\\\n\`;" \
  "markdown += \`- id:\${item.id} \${item.description}\\\n\`;" \
  "$TODO_TEST"

# M28: Return null instead of empty string for empty list
run_mutation \
  "todo-helpers: return null instead of empty string for empty list" \
  "$TODO_FILE" \
  "return '';" \
  "return null as unknown as string;" \
  "$TODO_TEST"

# ========================================================================
# Summary
# ========================================================================
echo "" >> "$RESULTS_FILE"
echo "=== SUMMARY ===" >> "$RESULTS_FILE"
echo "Total mutations: $TOTAL" >> "$RESULTS_FILE"
echo "Killed (test caught the bug): $PASSED" >> "$RESULTS_FILE"
echo "Survived (test MISSED the bug): $SURVIVED" >> "$RESULTS_FILE"
SCORE=$(( PASSED * 100 / TOTAL ))
echo "Mutation Score: $SCORE% ($PASSED/$TOTAL)" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

echo ""
echo "=== SUMMARY ==="
echo "Total mutations: $TOTAL"
echo "Killed: $PASSED"
echo "Survived: $SURVIVED"
echo "Mutation Score: $SCORE%"
