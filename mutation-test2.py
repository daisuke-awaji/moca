#!/usr/bin/env python3
"""Mutation testing: inject bugs, run tests, check if caught."""
import subprocess, sys, os

REPO = "/tmp/ws/development/moca"
os.chdir(REPO)

results = []

def run_mutation(mid, desc, filepath, find_str, replace_str, test_cmd):
    # Read original
    with open(filepath) as f:
        original = f.read()
    
    if find_str not in original:
        print(f"⚠️  SKIP     M{mid}: {desc} (pattern not found)")
        results.append(("SKIP", mid, desc))
        return
    
    # Apply mutation
    mutated = original.replace(find_str, replace_str, 1)
    with open(filepath, 'w') as f:
        f.write(mutated)
    
    # Run tests
    r = subprocess.run(test_cmd, shell=True, capture_output=True, timeout=120)
    
    # Restore
    with open(filepath, 'w') as f:
        f.write(original)
    
    if r.returncode == 0:
        print(f"❌ SURVIVED  M{mid}: {desc}")
        results.append(("SURVIVED", mid, desc))
    else:
        print(f"✅ KILLED    M{mid}: {desc}")
        results.append(("KILLED", mid, desc))

CONV = "packages/agent/src/session/converters.ts"
CONV_T = "cd packages/agent && NODE_OPTIONS='--experimental-vm-modules --no-warnings' npx jest src/session/__tests__/converters.test.ts --silent 2>/dev/null"

ZOD = "packages/agent/src/schemas/zod-converter.ts"
ZOD_T = "cd packages/agent && NODE_OPTIONS='--experimental-vm-modules --no-warnings' npx jest src/schemas/__tests__/zod-converter.test.ts --silent 2>/dev/null"

SCHED = "packages/backend/src/services/scheduler-service.ts"
SCHED_T = "cd packages/backend && npx jest src/services/__tests__/scheduler-service.test.ts --silent 2>/dev/null"

AUTH = "packages/backend/src/middleware/auth.ts"
AUTH_T = "cd packages/backend && npx jest src/middleware/__tests__/auth.test.ts --silent 2>/dev/null"

AUTHRES = "packages/agent/src/handlers/auth-resolver.ts"
AUTHRES_T = "cd packages/agent && NODE_OPTIONS='--experimental-vm-modules --no-warnings' npx jest src/handlers/__tests__/auth-resolver-extended.test.ts --silent 2>/dev/null"

CTX = "packages/lambda-tools/shared/src/context-parser.ts"
CTX_T = "cd packages/lambda-tools/shared && npx jest src/__tests__/context-parser.test.ts --silent 2>/dev/null"

REG = "packages/lambda-tools/shared/src/tool-registry.ts"
REG_T = "cd packages/lambda-tools/shared && npx jest src/__tests__/tool-registry.test.ts --silent 2>/dev/null"

TITLE = "packages/agent/src/services/title-generator.ts"
TITLE_T = "cd packages/agent && NODE_OPTIONS='--experimental-vm-modules --no-warnings' npx jest src/services/__tests__/title-generator.test.ts --silent 2>/dev/null"

DISP = "packages/agent/src/utils/display-path.ts"
DISP_T = "cd packages/agent && NODE_OPTIONS='--experimental-vm-modules --no-warnings' npx jest src/utils/__tests__/display-path.test.ts --silent 2>/dev/null"

TODO = "packages/agent/src/tools/todo/helpers.ts"
TODO_T = "cd packages/agent && NODE_OPTIONS='--experimental-vm-modules --no-warnings' npx jest src/tools/todo/__tests__/helpers.test.ts --silent 2>/dev/null"

AGENTS = "packages/backend/src/services/agents-service.ts"
AGENTS_T = "cd packages/backend && npx jest src/services/__tests__/agents-service.test.ts --silent 2>/dev/null"

INVOKER = "packages/trigger/src/services/agent-invoker.ts"
INVOKER_T = "cd packages/trigger && NODE_OPTIONS='--experimental-vm-modules --no-warnings' npx jest src/services/__tests__/agent-invoker.test.ts --silent 2>/dev/null"

print("=== Mutation Testing ===\n")

# --- converters.ts ---
run_mutation(1, "converters: swap role mapping user→ASSISTANT",
    CONV, "message.role === 'user' ? 'USER' : 'ASSISTANT'",
          "message.role === 'user' ? 'ASSISTANT' : 'USER'", CONV_T)

run_mutation(2, "converters: break single-text-block shortcut",
    CONV, "!hasNonTextContent && message.content.length === 1",
          "!hasNonTextContent && message.content.length === 0", CONV_T)

run_mutation(3, "converters: swap USER→assistant in deserialization",
    CONV, "payload.conversational.role === 'USER' ? 'user' : 'assistant'",
          "payload.conversational.role === 'USER' ? 'assistant' : 'user'", CONV_T)

run_mutation(4, "converters: Buffer toString wrong encoding (utf16le)",
    CONV, "(payload.blob as Buffer).toString('utf8')",
          "(payload.blob as Buffer).toString('utf16le')", CONV_T)

run_mutation(5, "converters: base64 decode with hex instead",
    CONV, "Buffer.from(payload.blob, 'base64').toString('utf8')",
          "Buffer.from(payload.blob, 'hex').toString('utf8')", CONV_T)

run_mutation(6, "converters: default image format png→jpeg",
    CONV, "|| 'png',", "|| 'jpeg',", CONV_T)

run_mutation(7, "converters: break legacy tool detection",
    CONV, "blobObj.messageType === 'tool'",
          "blobObj.messageType === 'tool_BROKEN'", CONV_T)

run_mutation(8, "converters: empty content returns '' instead of ' '",
    CONV, "content: { text: ' ' }, // Minimum 1 character",
          "content: { text: '' }, // Minimum 1 character", CONV_T)

run_mutation(9, "converters: skip imageBlock base64 serialization",
    CONV, "const serialized = serializeImageBlock(block);",
          "const serialized = null;", CONV_T)

run_mutation(10, "converters: toolUseBlock→textBlock in createContentBlockFromToolData",
    CONV, "type: 'toolUseBlock',", "type: 'textBlock',", CONV_T)

# --- zod-converter.ts ---
run_mutation(11, "zod: truncate at 32 instead of 64",
    ZOD, "if (sanitized.length > 64)", "if (sanitized.length > 32)", ZOD_T)

run_mutation(12, "zod: skip character sanitization",
    ZOD, "let sanitized = key.replace(/[^a-zA-Z0-9_.-]/g, '_');",
         "let sanitized = key;", ZOD_T)

run_mutation(13, "zod: wrong fallback '_param'→''",
    ZOD, "sanitized = '_param';", "sanitized = '';", ZOD_T)

run_mutation(14, "zod: required field treated as optional",
    ZOD, "if (!required.includes(key))", "if (true)", ZOD_T)

run_mutation(15, "zod: number type mapped as string",
    ZOD, "case 'number':\n      case 'integer':\n        zodType = z.number();",
         "case 'number':\n      case 'integer':\n        zodType = z.string();", ZOD_T)

# --- scheduler-service.ts ---
run_mutation(16, "scheduler: skip cron() wrapping",
    SCHED, "return `cron(${trimmed})`;", "return trimmed;", SCHED_T)

run_mutation(17, "scheduler: wrong rate substring index",
    SCHED, "return `rate(${trimmed.substring(5)})`;",
           "return `rate(${trimmed.substring(4)})`;", SCHED_T)

run_mutation(18, "scheduler: DISABLED instead of ENABLED default",
    SCHED, "State: config.enabled === false ? 'DISABLED' : 'ENABLED',",
           "State: config.enabled === false ? 'DISABLED' : 'DISABLED',", SCHED_T)

# --- auth middleware ---
run_mutation(19, "auth: isMachineUser always true (SECURITY!)",
    AUTH, "return payload.token_use === 'access';", "return true;", AUTH_T)

run_mutation(20, "auth: isMachineUser always false",
    AUTH, "return payload.token_use === 'access';", "return false;", AUTH_T)

run_mutation(21, "auth: extractJWTFromHeader skip Bearer check",
    AUTH, "if (!authHeader.startsWith(bearerPrefix))",
          "if (false)", AUTH_T)

# --- auth-resolver.ts ---
run_mutation(22, "auth-resolver: accept any scope",
    AUTHRES, "if (!scopes.includes(REQUIRED_MACHINE_USER_SCOPE))", "if (false)", AUTHRES_T)

run_mutation(23, "auth-resolver: UUID regex always matches",
    AUTHRES, "if (!uuidRegex.test(targetUserId))", "if (false)", AUTHRES_T)

run_mutation(24, "auth-resolver: allow targetUserId for regular users (PRIV ESCALATION!)",
    AUTHRES, "if (targetUserId) {\n    return {\n      userId: '',\n      error: {\n        status: 403,\n        message: 'targetUserId is not allowed for regular users',",
             "if (false) {\n    return {\n      userId: '',\n      error: {\n        status: 403,\n        message: 'targetUserId is not allowed for regular users',", AUTHRES_T)

# --- context-parser.ts ---
run_mutation(25, "context-parser: wrong delimiter '---'",
    CTX, "const delimiter = '___';", "const delimiter = '---';", CTX_T)

run_mutation(26, "context-parser: extractToolName always returns null",
    CTX, "return processedToolName;", "return null;", CTX_T)

# --- tool-registry.ts ---
run_mutation(27, "tool-registry: getHandler always returns default",
    REG, "const tool = this.registry.get(toolName);", "const tool = undefined;", REG_T)

run_mutation(28, "tool-registry: allow duplicate registration",
    REG, "if (this.registry.has(tool.name)) {", "if (false) {", REG_T)

# --- title-generator.ts ---
run_mutation(29, "title-generator: skip quote stripping regex",
    TITLE, """title = title.replace(/^["'\u300c\u300d\u300e\u300f\u201c\u201d\u2018\u2019]+|["'\u300c\u300d\u300e\u300f\u201c\u201d\u2018\u2019]+$/g, '');""",
           "// MUTATION: quote stripping disabled", TITLE_T)

run_mutation(30, "title-generator: wrong truncation 50→100",
    TITLE, "if (title.length > 50)", "if (title.length > 100)", TITLE_T)

run_mutation(31, "title-generator: skip message truncation in buildPrompt",
    TITLE, "const truncatedUserMessage = userMessage.substring(0, 500);",
           "const truncatedUserMessage = userMessage;", TITLE_T)

# --- display-path.ts ---
run_mutation(32, "display-path: always return '/'",
    DISP, "return filePath.slice(WORKSPACE_DIRECTORY.length) || '/';",
          "return '/';", DISP_T)

run_mutation(33, "display-path: don't strip prefix",
    DISP, "if (filePath.startsWith(WORKSPACE_DIRECTORY)) {",
          "if (false) {", DISP_T)

# --- todo helpers.ts ---
run_mutation(34, "todo: missing status in markdown",
    TODO, "markdown += `- id:${item.id} (${item.status}) ${item.description}\\n`;",
          "markdown += `- id:${item.id} ${item.description}\\n`;", TODO_T)

run_mutation(35, "todo: return null instead of '' for empty list",
    TODO, "    return '';\n  }", "    return null as unknown as string;\n  }", TODO_T)

# --- agents-service.ts ---
run_mutation(36, "agents-service: isShared always 'true'",
    AGENTS, "isShared: agent.isShared ? 'true' : 'false',",
            "isShared: 'true',", AGENTS_T)

run_mutation(37, "agents-service: fromDynamo always true",
    AGENTS, "isShared: dynamoAgent.isShared === 'true',",
            "isShared: true,", AGENTS_T)

# --- agent-invoker.ts ---
run_mutation(38, "agent-invoker: skip ARN encoding entirely",
    INVOKER, "if (url.includes('bedrock-agentcore') && url.includes('/runtimes/arn:')) {",
             "if (false) {", INVOKER_T)

# === SUMMARY ===
print("\n=== MUTATION TEST SUMMARY ===")
killed = sum(1 for r in results if r[0] == "KILLED")
survived = sum(1 for r in results if r[0] == "SURVIVED")
skipped = sum(1 for r in results if r[0] == "SKIP")
total = killed + survived
score = killed * 100 // total if total > 0 else 0
print(f"Total mutations: {total} (skipped: {skipped})")
print(f"Killed (caught): {killed}")
print(f"Survived (MISSED): {survived}")
print(f"Mutation Score: {score}%")
print()
if survived > 0:
    print("=== SURVIVING MUTATIONS (test weaknesses) ===")
    for status, mid, desc in results:
        if status == "SURVIVED":
            print(f"  M{mid}: {desc}")
