# GitLab NPM Registry Setup for MCP Servers

This document explains how to configure the AgentCore runtime to use MCP servers hosted in GitLab's NPM registry.

## Overview

The Agent runtime supports MCP servers distributed via GitLab NPM registry (e.g., `@slidev-theme-aws/mcp`). The system automatically configures npm to access private GitLab registries using AWS Secrets Manager for token management.

## Architecture

```
┌─────────────────┐
│  Agent Server   │
│   (Container)   │
└────────┬────────┘
         │
         ├─ startup.sh retrieves GITLAB_TOKEN
         ├─ Creates /tmp/.npmrc with registry config
         ├─ Exports NPM_CONFIG_USERCONFIG env var
         └─ npx/bun uses .npmrc for scoped packages
```

**Supported MCP Runtimes:**
- **Node.js/npm**: Default runtime for `npx` commands
- **Bun**: JavaScript/TypeScript runtime for faster execution
- **Python (uv/uvx)**: For Python-based MCP servers

## Prerequisites

### 1. GitLab Personal Access Token

Create a Personal Access Token with `read_api` scope:

1. Go to GitLab → User Settings → Access Tokens
2. Create token with `read_api` scope
3. Copy the token (starts with `glpat-`)

### 2. AWS Secrets Manager

Store the GitLab token in AWS Secrets Manager:

```bash
# For dev environment
aws secretsmanager create-secret \
  --name "agentcore/dev/gitlab-token" \
  --secret-string "glpat-xxxxxxxxxxxxxxxxxxxx" \
  --region us-east-1

# For other environments, use: agentcore/{env}/gitlab-token
# - agentcore/default/gitlab-token
# - agentcore/stg/gitlab-token
# - agentcore/prd/gitlab-token
```

## Configuration

### Step 1: Set Environment Variable

Configure the Agent container/Lambda to use the secret:

The environment variable is automatically configured through the CDK stack based on the environment configuration (`packages/cdk/config/environments.ts`).

**Environment-specific secret names:**
- `default`: `agentcore/default/gitlab-token`
- `dev`: `agentcore/dev/gitlab-token`
- `stg`: `agentcore/stg/gitlab-token`
- `prd`: `agentcore/prd/gitlab-token`

**For local development:**
```bash
# .env file
GITLAB_TOKEN_SECRET_NAME=agentcore/dev/gitlab-token
AWS_REGION=us-east-1
```

### Step 2: Grant IAM Permissions

The Agent's IAM role needs permission to read the secret:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:us-east-1:ACCOUNT_ID:secret:agentcore/*/gitlab-token-*"
    }
  ]
}
```

### Step 3: Configure MCP Server in Agent

In the Agent configuration UI, add the MCP server:

**For Node.js runtime:**
```json
{
  "mcpServers": {
    "slidev-theme-aws": {
      "command": "npx",
      "args": ["-y", "@slidev-theme-aws/mcp"]
    }
  }
}
```

**For Bun runtime:**
```json
{
  "mcpServers": {
    "slidev-theme-aws": {
      "command": "bun",
      "args": ["x", "@slidev-theme-aws/mcp"]
    }
  }
}
```

**Note:** You don't need to specify npm registry configuration in the MCP settings. The startup script handles this automatically for both npm and Bun runtimes.

## How It Works

### Startup Process

1. **Token Retrieval**: `startup.sh` retrieves GitLab token from Secrets Manager
2. **.npmrc Generation**: Creates `/tmp/.npmrc` with registry configuration:
   ```
   @slidev-theme-aws:registry=https://gitlab.aws.dev/api/v4/packages/npm/
   //gitlab.aws.dev/api/v4/packages/npm/:_authToken=glpat-xxxx
   ```
3. **Config Path Export**: Sets `NPM_CONFIG_USERCONFIG=/tmp/.npmrc` environment variable
4. **Package Installation**: `npx` automatically uses the configured registry for scoped packages

### Registry Configuration Format

The generated `.npmrc` follows npm's scoped registry format:

```ini
# Scope-specific registry
@SCOPE:registry=REGISTRY_URL

# Authentication token for the registry
//REGISTRY_HOST/PATH/:_authToken=TOKEN
```

## Supported Registries

### GitLab (Internal)
- **Registry URL**: `https://gitlab.aws.dev/api/v4/packages/npm/`
- **Scopes**: `@slidev-theme-aws`, or any internal scope
- **Authentication**: Personal Access Token via Secrets Manager

### Adding More Scopes

To support multiple GitLab scopes, update `startup.sh`:

```bash
cat > /tmp/.npmrc << EOF
@slidev-theme-aws:registry=https://gitlab.aws.dev/api/v4/packages/npm/
@another-scope:registry=https://gitlab.aws.dev/api/v4/packages/npm/
//gitlab.aws.dev/api/v4/packages/npm/:_authToken=${GITLAB_TOKEN}
EOF
```

## Troubleshooting

### Common Issues

#### 1. Package Not Found

**Symptom**: `npm ERR! 404 Not Found`

**Solutions**:
- Verify the package exists in GitLab registry
- Check scope name matches exactly (e.g., `@slidev-theme-aws`)
- Ensure Personal Access Token has `read_api` scope

#### 2. Authentication Failed

**Symptom**: `npm ERR! 401 Unauthorized`

**Solutions**:
- Verify secret exists in Secrets Manager
- Check IAM permissions for GetSecretValue
- Ensure token hasn't expired
- Verify `GITLAB_TOKEN_SECRET_NAME` environment variable is set

#### 3. Registry Not Used

**Symptom**: 
```
npm error 404 Not Found - GET https://registry.npmjs.org/@slidev-theme-aws%2fmcp
npm error 404 '@slidev-theme-aws/mcp@*' is not in this registry.
```

**Cause**: The `.npmrc` file is not being read by npm, so it defaults to the public npmjs.org registry.

**Solutions**:
- Verify `/tmp/.npmrc` is created (check startup logs for "✅ GitLab NPM registry configured successfully")
- Ensure `NPM_CONFIG_USERCONFIG` environment variable is exported in startup.sh
- Verify scope format is correct (`@scope:registry=...`)
- Check the startup logs for `NPM_CONFIG_USERCONFIG set to: /tmp/.npmrc`

**Example Error Log**:
```
npm notice Access token expired or revoked. Please try logging in again.
npm error code E404
npm error 404 Not Found - GET https://registry.npmjs.org/@slidev-theme-aws%2fmcp
```

**Fix**: Ensure startup.sh exports the NPM_CONFIG_USERCONFIG variable:
```bash
export NPM_CONFIG_USERCONFIG=/tmp/.npmrc
```

### Debug Commands

**Check .npmrc contents:**
```bash
docker exec CONTAINER_ID cat /tmp/.npmrc
```

**Verify NPM_CONFIG_USERCONFIG:**
```bash
docker exec CONTAINER_ID env | grep NPM_CONFIG
```

**Verify npm config:**
```bash
docker exec CONTAINER_ID npm config list
```

**Test package access:**
```bash
docker exec CONTAINER_ID npm view @slidev-theme-aws/mcp
```

**Verify Bun installation:**
```bash
docker exec CONTAINER_ID bun --version
```

## Security Considerations

### Token Security

- ✅ **DO**: Store tokens in AWS Secrets Manager
- ✅ **DO**: Use IAM roles for access control
- ✅ **DO**: Set appropriate secret rotation policies
- ❌ **DON'T**: Hardcode tokens in code or configuration
- ❌ **DON'T**: Commit tokens to version control
- ❌ **DON'T**: Share tokens across environments

### .npmrc File Security

- `.npmrc` is created with `chmod 600` (owner read/write only)
- File is stored in `/tmp` (ephemeral, not persisted)
- Token is never logged or exposed in error messages

### IAM Best Practices

Use least-privilege IAM policies:

```json
{
  "Effect": "Allow",
  "Action": "secretsmanager:GetSecretValue",
  "Resource": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:agentcore/gitlab-token-*",
  "Condition": {
    "StringEquals": {
      "aws:RequestedRegion": "us-east-1"
    }
  }
}
```

## Limitations

1. **Scoped Packages Only**: Only packages with scopes (e.g., `@scope/package`) can use custom registries
2. **Single Token**: One GitLab token is used for all scopes from the same registry
3. **Startup Configuration**: Registry configuration is applied at container startup, not dynamically

## Related Documentation

- [MCP Server Configuration](./mcp-server-configuration.md)
- [AWS Secrets Manager Best Practices](https://docs.aws.amazon.com/secretsmanager/latest/userguide/best-practices.html)
- [npm Scoped Packages](https://docs.npmjs.com/cli/v8/using-npm/scope)
- [GitLab Package Registry](https://docs.gitlab.com/ee/user/packages/npm_registry/)

## Changelog

- **2025-01-09**: 
  - Initial documentation for GitLab NPM registry support
  - Added NPM_CONFIG_USERCONFIG environment variable export
  - Added Bun runtime support for JavaScript/TypeScript MCP servers
