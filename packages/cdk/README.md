# CDK - Multi-Environment Deployment

CDK stack for multi-environment deployment of Amazon Bedrock AgentCore

## 📁 Project Structure

```
packages/cdk/
├── bin/
│   └── app.ts              # CDK app entry point
├── lib/
│   ├── agentcore-stack.ts  # Main stack
│   └── constructs/         # Reusable constructs
└── config/
    ├── environments.ts     # Environment-specific configurations
    └── index.ts
```

## 🌍 Supported Environments

| Environment | Stack Name | Purpose | Termination Protection |
|-------------|-----------|---------|----------------------|
| dev | DevAgentCoreApp | Development & Testing | ❌ OFF |
| stg | StgAgentCoreApp | Staging & QA | ❌ OFF |
| prd | PrdAgentCoreApp | Production | ✅ ON |

## 🚀 Deployment Methods

### Prerequisites: Setting up Tavily API Key

All environments use AWS Secrets Manager to manage the Tavily API key:

```bash
# For default environment
aws secretsmanager create-secret \
  --name "agentcore/default/tavily-api-key" \
  --secret-string "tvly-your-api-key-here" \
  --region ap-northeast-1

# For development environment
aws secretsmanager create-secret \
  --name "agentcore/dev/tavily-api-key" \
  --secret-string "tvly-your-api-key-here" \
  --region ap-northeast-1

# For staging environment
aws secretsmanager create-secret \
  --name "agentcore/stg/tavily-api-key" \
  --secret-string "tvly-your-api-key-here" \
  --region ap-northeast-1

# For production environment
aws secretsmanager create-secret \
  --name "agentcore/prd/tavily-api-key" \
  --secret-string "tvly-your-api-key-here" \
  --region ap-northeast-1
```

> **Note**: For local development, you can set `TAVILY_API_KEY` in `packages/agent/.env` as a fallback, but deployed environments only use Secrets Manager.

### Deploy to Development Environment

```bash
# Development environment (default)
npm run deploy:dev

# Or
npx -w packages/cdk cdk deploy -c env=dev
```

### Deploy to Staging Environment

```bash
npm run deploy:stg
```

### Deploy to Production Environment

```bash
# Production requires approval
npm run deploy:prd

# Or
npx -w packages/cdk cdk deploy -c env=prd --require-approval broadening
```

## 🔍 Checking Differences

Review changes before deployment:

```bash
# Development environment
npm run diff:dev

# Staging environment
npm run diff:stg

# Production environment
npm run diff:prd
```

## 🔧 Environment Configuration

Environment-specific configurations are defined in `config/environments.ts`.

### Main Configuration Items

| Configuration | dev | stg | prd |
|--------------|-----|-----|-----|
| Gateway Name | agentcore-dev | agentcore-stg | agentcore-prd |
| Memory TTL | 30 days | 60 days | 365 days |
| S3 Removal Policy | DESTROY | RETAIN | RETAIN |
| CORS | `*` | Limited URLs | Limited URLs |
| Log Retention | 7 days | 14 days | 30 days |
| Tavily API Key | Secrets Manager | Secrets Manager | Secrets Manager |
| Sign-up Domain Restriction | amazon.com, amazon.jp | None | None |

### Adding Custom Configuration

Edit `config/environments.ts` to add environment-specific settings:

```typescript
export const environments: Record<Environment, EnvironmentConfig> = {
  dev: {
    env: 'dev',
    awsRegion: 'ap-northeast-1',
    awsAccount: '123456789012', // Optional: Specify AWS account
    gatewayName: 'agentcore-dev',
    allowedSignUpEmailDomains: ['amazon.com', 'amazon.jp'], // Optional: Allowed sign-up domains
    // ... other settings
  },
  // ...
};
```

### Sign-up Domain Restriction

You can restrict which email domains are allowed to sign up in the Cognito User Pool. This feature allows you to configure sign-ups to be limited to users from specific organizations or domains.

#### Configuration

Add `allowedSignUpEmailDomains` to each environment configuration in `config/environments.ts`:

```typescript
dev: {
  // ... other settings
  allowedSignUpEmailDomains: ['amazon.com', 'amazon.jp'],
},
```

#### Behavior

- **With configuration**: Only email addresses from specified domains can sign up
- **Without configuration** (`undefined` or empty array): Allow sign-ups from all domains
- **Validation timing**: Validated by Pre Sign Up Lambda trigger
- **Error message**: Clear error message displayed for disallowed domains

#### Configuration Examples

```typescript
// Allow only specific domains
allowedSignUpEmailDomains: ['example.com', 'example.jp']

// Allow multiple organization domains
allowedSignUpEmailDomains: ['company1.com', 'company2.com', 'partner.co.jp']

// No restriction (allow all domains)
allowedSignUpEmailDomains: undefined
// Or
// allowedSignUpEmailDomains: []
```

#### Checking Lambda Function Logs

To verify that domain restrictions are working correctly, check CloudWatch Logs:

```bash
# View Lambda function log stream
aws logs tail /aws/lambda/PreSignUpTrigger --follow
```

During sign-up attempts, you'll see logs like:

- Allowed domain: `Sign up allowed: Email domain 'amazon.com' is in allowed list`
- Denied domain: `Sign up denied: Email domain 'gmail.com' is not in allowed list: amazon.com, amazon.jp`

### Custom Domain Configuration

You can configure a custom domain for your frontend application using Route53 and ACM (AWS Certificate Manager). The CloudFront distribution will automatically use your custom domain with an SSL certificate.

#### Prerequisites

- A public hosted zone must be created in Route53 in the same AWS account
- For more information on public hosted zones, see: [Using Public Hosted Zones - Amazon Route 53](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/AboutHZWorkingWith.html)

#### Configuration

Add `customDomain` to each environment configuration in `config/environments.ts`:

```typescript
dev: {
  // ... other settings
  customDomain: {
    hostName: 'genai',
    domainName: 'example.com',
  },
},
```

This will create:
- ACM certificate for `genai.example.com` (automatically validated via DNS)
- CloudFront distribution with custom domain
- Route53 A record pointing to CloudFront

Final website URL: `https://genai.example.com`

#### Configuration Examples

```typescript
// Development environment with custom domain
dev: {
  // ... other settings
  customDomain: {
    hostName: 'dev-genai',
    domainName: 'example.com',
  },
},
// Result: https://dev-genai.example.com

// Staging environment with custom domain
stg: {
  // ... other settings
  customDomain: {
    hostName: 'stg-genai',
    domainName: 'example.com',
  },
},
// Result: https://stg-genai.example.com

// Production without custom domain (uses CloudFront default domain)
prd: {
  // ... other settings
  customDomain: undefined,
},
// Result: https://d1234567890abc.cloudfront.net
```

#### How It Works

1. **Hosted Zone Lookup**: CDK automatically finds the hosted zone using the `domainName`
2. **Certificate Creation**: ACM certificate is created in `us-east-1` (required for CloudFront)
3. **DNS Validation**: Certificate is automatically validated using DNS records in Route53
4. **CloudFront Configuration**: Distribution is configured with the custom domain and certificate
5. **A Record Creation**: Route53 A record is created pointing to the CloudFront distribution

#### Important Notes

- The hosted zone must exist in the same AWS account before deployment
- Certificate creation and DNS validation may take several minutes
- Stack must have explicit `env` property (account/region) for hosted zone lookup
- No need to specify `hostedZoneId` - it's automatically looked up by domain name

## 🗑️ Stack Deletion

### Development Environment

```bash
npm run destroy:dev
```

### Staging Environment

```bash
npm run destroy:stg
```

### Production Environment

```bash
# Production has termination protection enabled, requires manual disabling
aws cloudformation update-termination-protection \
  --stack-name PrdAgentCoreApp \
  --no-enable-termination-protection

npx -w packages/cdk cdk destroy -c env=prd
```

## 📝 Deployment Examples

### First-time Deployment (Bootstrap)

CDK Bootstrap is required for first-time deployment:

```bash
# Default region
npx -w packages/cdk cdk bootstrap

# Specific region
npx -w packages/cdk cdk bootstrap aws://ACCOUNT-ID/ap-northeast-1
```

### Complete Deployment Flow to Development Environment

```bash
# 1. Check differences
npm run diff:dev

# 2. Deploy
npm run deploy:dev

# 3. Check outputs
# The following will be displayed in CloudFormation Outputs section:
# - UserPoolId
# - UserPoolClientId
# - FrontendUrl
# - BackendApiUrl
# - RuntimeInvocationEndpoint
# etc.
```

## 🔐 Credentials

Appropriate AWS credentials are required for deployment:

```bash
# Use AWS CLI profile
export AWS_PROFILE=your-profile

# Or specify with environment variables
export AWS_ACCESS_KEY_ID=xxx
export AWS_SECRET_ACCESS_KEY=xxx
export AWS_DEFAULT_REGION=ap-northeast-1
```

## 📊 Stack Outputs

After deployment, the following information is output as CloudFormation Outputs:

- **GatewayId**: AgentCore Gateway ID
- **UserPoolId**: Cognito User Pool ID
- **UserPoolClientId**: Cognito Client ID
- **FrontendUrl**: Frontend application URL
- **BackendApiUrl**: Backend API URL
- **RuntimeInvocationEndpoint**: Runtime invocation endpoint
- **MemoryId**: AgentCore Memory ID
- **UserStorageBucketName**: User storage S3 bucket name

## 🔧 Troubleshooting

### Stack Name Already Exists

Delete the existing stack or change the environment name:

```bash
npx -w packages/cdk cdk destroy -c env=dev
```

### Bootstrap Required

```bash
npx -w packages/cdk cdk bootstrap
```

### Incorrect Region

Check the target region in `config/environments.ts`.

### Verifying Tavily API Key

Check if it's correctly configured in Secrets Manager:

```bash
# Check secret value
aws secretsmanager get-secret-value \
  --secret-id "agentcore/prd/tavily-api-key" \
  --query SecretString \
  --output text

# Update secret
aws secretsmanager update-secret \
  --secret-id "agentcore/prd/tavily-api-key" \
  --secret-string "tvly-new-api-key"
```

## 📚 Related Documentation

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [Amazon Bedrock AgentCore](https://docs.aws.amazon.com/bedrock/)
- [Deployment Guide](../../docs/DEVELOPMENT.md)

## 💡 Tips

### Switching Environments

Use the context parameter `-c env=<environment-name>`:

```bash
# Explicitly specify environment
npx -w packages/cdk cdk deploy -c env=stg

# Defaults to dev if omitted
npx -w packages/cdk cdk deploy
```

### Customizing Stack Name

Edit the following line in `bin/app.ts`:

```typescript
const stackName = `${envName.charAt(0).toUpperCase() + envName.slice(1)}AgentCoreApp`;
```

### Production Environment Safety

The following protections are enabled for production:

- **Termination Protection**: Prevents accidental stack deletion
- **S3 RETAIN Policy**: Retains bucket data
- **Approval Flow**: Requires change confirmation during deployment
- **Cognito Deletion Protection**: Prevents accidental user pool deletion
