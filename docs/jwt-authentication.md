# JWT Authentication System

## 🔐 JWT Authentication Flow

```mermaid
sequenceDiagram
    participant F as Frontend/Client
    participant Cognito as Cognito User Pool
    participant B as Backend API
    participant A as Agent Runtime
    participant G as AgentCore Gateway
    participant L as Lambda Tools

    F->>Cognito: 1. Authentication Request
    Cognito-->>F: 2. JWT Access Token

    F->>B: 3. API Request (Bearer Token)
    B->>B: 4. JWT Verification (JWKS)
    
    B->>A: 5. POST /invocations (JWT Context)
    A->>A: 6. Execute Local Tools

    A->>G: 7. MCP tools/call (JWT forwarding)
    G->>G: 8. JWT Verification
    G->>L: 9. Lambda Invoke
    L-->>G: 10. Tool Result
    G-->>A: 11. MCP Response

    A-->>B: 12. Agent Response
    B-->>F: 13. HTTP Response
```

## 📋 Architecture Overview

### Components and Their Roles

| Component | Port | Role | JWT Handling |
|-----------|------|------|--------------|
| **Frontend** | 5173 | Web UI | Sends JWT in Authorization header |
| **Backend** | 3000 | API Server | **Verifies JWT** with Cognito JWKS |
| **Agent** | 8080 | AI Agent Runtime | Receives JWT context from Backend |
| **AgentCore Gateway** | - | MCP Server | Verifies JWT for Lambda tools |
| **Cognito** | - | Authentication | Issues JWT tokens |

### Key Authentication Points

1. **Primary JWT Verification**: Backend API (`packages/backend/src/middleware/auth.ts`)
   - Verifies JWT signature using Cognito JWKS
   - Validates token claims (exp, iss, aud)
   - Extracts user information

2. **Secondary Verification**: AgentCore Gateway
   - Verifies JWT for remote MCP tool calls
   - Ensures secure access to Lambda functions

## 🔑 JWT Token Flow

### 1. User Authentication
```bash
# User logs in via Frontend
Frontend → Cognito: username/password
Cognito → Frontend: JWT Access Token
```

### 2. API Request with JWT
```bash
# Frontend includes JWT in all API requests
GET /sessions
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. Backend Verification
```typescript
// packages/backend/src/middleware/auth.ts
export function jwtAuthMiddleware(req, res, next) {
  const token = extractJWTFromHeader(req.get('Authorization'));
  
  // Verify JWT with Cognito JWKS
  const result = await verifyJWT(token);
  
  if (result.valid) {
    req.jwt = result.payload;
    req.userId = result.payload.sub;
    next();
  } else {
    res.status(401).json({ error: 'Invalid JWT' });
  }
}
```

### 4. Agent Invocation
```typescript
// Backend forwards request to Agent with user context
POST http://localhost:8080/invocations
Headers:
  X-Actor-Id: user-id-from-jwt
Body:
  prompt: "User's message"
  storagePath: "/user/workspace"
```

## 🔒 Security Features

### Backend JWT Verification (aws-jwt-verify)
- **Library**: [aws-jwt-verify](https://github.com/awslabs/aws-jwt-verify) — AWS officially recommended for Node.js
- **JWKS Management**: Automatic fetching, caching, and key rotation from Cognito JWKS endpoint
- **Signature Verification**: RS256 algorithm
- **Claims Validation**: Checks expiration, issuer, token_use, client_id (all automatic)
- **JWKS Hydration**: Pre-loads JWKS cache on server startup for faster first verification

### All Environments
- JWT verification via aws-jwt-verify is **always enforced** regardless of `NODE_ENV`
- `COGNITO_USER_POOL_ID` and `COGNITO_REGION` are **required** — the server will not start without them
- No "decode only" fallback mode exists

### Token Information Extracted
```json
{
  "sub": "user-id",
  "cognito:username": "john.doe",
  "email": "john.doe@example.com",
  "cognito:groups": ["users", "admins"],
  "token_use": "access",
  "exp": 1703061600,
  "iat": 1703058000
}
```

## 📡 API Endpoints

### Backend Endpoints

#### Health Check (No Auth)
```bash
GET /ping
→ Returns service health status
```

#### User Information (Auth Required)
```bash
GET /me
Authorization: Bearer <jwt_token>
→ Returns authenticated user info
```

#### Session Management (Auth Required)
```bash
GET /sessions
POST /sessions
DELETE /sessions/:id
Authorization: Bearer <jwt_token>
→ Manage user sessions
```

### Agent Endpoints

#### Agent Invocation (Internal)
```bash
POST /invocations
Headers:
  X-Actor-Id: <user-id>
Body:
  prompt: "User message"
  sessionId: "optional-session-id"
  storagePath: "/user/workspace"
```

## 🛡️ Error Handling

### Authentication Errors

| Error Code | Status | Description |
|------------|--------|-------------|
| `MISSING_AUTHORIZATION` | 401 | Authorization header not provided |
| `INVALID_AUTHORIZATION_FORMAT` | 401 | Header not in "Bearer <token>" format |
| `INVALID_JWT` | 401 | JWT signature verification failed |
| `JWT_VERIFICATION_ERROR` | 500 | Internal error during verification |

### Example Error Response
```json
{
  "error": "Authentication Error",
  "message": "Authorization header is required",
  "code": "MISSING_AUTHORIZATION",
  "timestamp": "2025-12-19T10:42:00.000Z",
  "requestId": "req_1703057520123_abc123"
}
```

## 🔧 Configuration

### Backend Environment Variables
```bash
# Cognito Configuration (used by aws-jwt-verify)
COGNITO_USER_POOL_ID=ap-northeast-1_xxxxxxxxx
COGNITO_REGION=ap-northeast-1
# Optional: restrict accepted tokens to specific client
# COGNITO_CLIENT_ID=your-app-client-id

# Server Configuration
PORT=3000
NODE_ENV=production
```

### Frontend Configuration
```bash
# Cognito Configuration
VITE_COGNITO_USER_POOL_ID=ap-northeast-1_xxxxxxxxx
VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxx
VITE_AWS_REGION=ap-northeast-1

# Backend API
VITE_BACKEND_URL=http://localhost:3000
```

## 📚 Related Documentation

- [Local Development Setup](./local-development-setup.md) - Environment setup
- [Backend README](../packages/backend/README.md) - Backend API details
- [Agent README](../packages/agent/README.md) - Agent Runtime details
