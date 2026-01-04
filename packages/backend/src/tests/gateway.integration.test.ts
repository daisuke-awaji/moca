/**
 * AgentCore Gateway Integration Tests
 * Test tool list retrieval and search functionality with actual AWS environment connection
 */

import { gatewayService } from '../services/agentcore-gateway.js';
import { CognitoAuthHelper } from './cognito-helper.js';

// Environment variables for testing
const TEST_USER = 'testuser';
const TEST_PASSWORD = 'TestPassword123!';

describe('AgentCore Gateway Integration Tests', () => {
  let cognitoHelper: CognitoAuthHelper;
  let authToken: string;

  beforeAll(async () => {
    // Check environment variables
    const requiredEnvs = [
      'AGENTCORE_GATEWAY_ENDPOINT',
      'COGNITO_USER_POOL_ID',
      'COGNITO_CLIENT_ID',
      'COGNITO_REGION',
    ];

    const missingEnvs = requiredEnvs.filter((env) => !process.env[env]);
    if (missingEnvs.length > 0) {
      throw new Error(`Required environment variables are not set: ${missingEnvs.join(', ')}`);
    }

    // Initialize Cognito authentication helper
    cognitoHelper = new CognitoAuthHelper({
      userPoolId: process.env.COGNITO_USER_POOL_ID!,
      clientId: process.env.COGNITO_CLIENT_ID!,
      region: process.env.COGNITO_REGION!,
    });

    console.log('🔧 Cognito authentication helper initialization completed');
  });

  describe('Tool list retrieval with authentication', () => {
    beforeAll(async () => {
      // Execute Cognito authentication
      console.log('🔐 Executing Cognito authentication...');
      const authResult = await cognitoHelper.login(TEST_USER, TEST_PASSWORD);

      // Use Access Token (for Gateway authentication)
      authToken = authResult.accessToken;

      // Log Access Token information
      const payload = cognitoHelper.decodeJWT(authToken);
      if (payload) {
        console.log('✅ Access Token retrieved successfully:', {
          sub: payload.sub,
          username: payload.username,
          token_use: payload.token_use,
          client_id: payload.client_id,
          exp:
            payload.exp && typeof payload.exp === 'number'
              ? new Date(payload.exp * 1000).toISOString()
              : 'unknown',
          iat:
            payload.iat && typeof payload.iat === 'number'
              ? new Date(payload.iat * 1000).toISOString()
              : 'unknown',
        });
      }
    });

    it('listTools() - Can retrieve tool list with authentication', async () => {
      console.log('📋 Tool list retrieval test started (with authentication)');

      // Retrieve tool list with authentication
      const result = await gatewayService.listTools(authToken);

      // Assertions
      expect(result).toBeDefined();
      expect(result.tools).toBeDefined();
      expect(Array.isArray(result.tools)).toBe(true);
      expect(result.tools.length).toBeGreaterThan(0);

      // Verify each tool has required properties
      result.tools.forEach((tool) => {
        expect(tool.name).toBeDefined();
        expect(typeof tool.name).toBe('string');
        expect(tool.inputSchema).toBeDefined();
        expect(typeof tool.inputSchema).toBe('object');
      });

      console.log(`✅ Tool list retrieval successful: Retrieved ${result.tools.length} tools`);
      console.log('🔧 Retrieved tool names:', result.tools.map((t) => t.name).slice(0, 5));
      if (result.nextCursor) {
        console.log('📄 Next page available: nextCursor exists');
      } else {
        console.log('📄 All items retrieved: No nextCursor');
      }
    }, 30000);

    it('listTools() - Error occurs without authentication', async () => {
      console.log('🔒 No authentication test started');

      await expect(gatewayService.listTools()).rejects.toThrow();

      console.log('✅ Error correctly occurred without authentication');
    });
  });

  describe('Semantic search with authentication', () => {
    it('searchTools() - Can search tools with semantic search', async () => {
      console.log('🔍 Semantic search test started');

      const query = 'search';
      const searchResults = await gatewayService.searchTools(query, authToken);

      // Assertions
      expect(searchResults).toBeDefined();
      expect(Array.isArray(searchResults)).toBe(true);

      if (searchResults.length > 0) {
        // Verify properties if search results exist
        searchResults.forEach((tool) => {
          expect(tool.name).toBeDefined();
          expect(typeof tool.name).toBe('string');
          expect(tool.inputSchema).toBeDefined();
          expect(typeof tool.inputSchema).toBe('object');
        });

        console.log(`✅ Semantic search successful: ${searchResults.length} results`);
        console.log(
          '🔧 Tool names in search results:',
          searchResults.map((t) => t.name)
        );
      } else {
        console.log('⚠️  Semantic search returned 0 results');
      }
    }, 30000);

    it('searchTools() - Search test with different queries', async () => {
      console.log('🔍 Additional search test started');

      const queries = ['weather', 'test', 'api', 'data'];

      for (const query of queries) {
        console.log(`🔍 Searching with query "${query}"...`);
        const searchResults = await gatewayService.searchTools(query, authToken);

        expect(searchResults).toBeDefined();
        expect(Array.isArray(searchResults)).toBe(true);

        console.log(`   Results: ${searchResults.length} items`);
        if (searchResults.length > 0) {
          console.log(`   Example tool: ${searchResults[0].name}`);
        }
      }
    }, 60000);
  });

  describe('Error handling', () => {
    it('searchTools() - Authentication error occurs with invalid token', async () => {
      console.log('🔒 Invalid token test started');

      const invalidToken = 'invalid.jwt.token';
      const query = 'test';

      await expect(gatewayService.searchTools(query, invalidToken)).rejects.toThrow();

      console.log('✅ Error correctly occurred with invalid token');
    });

    it('searchTools() - Validation error occurs with empty query', async () => {
      console.log('📝 Empty query test started');

      await expect(gatewayService.searchTools('', authToken)).rejects.toThrow(
        'Search query is required'
      );

      await expect(gatewayService.searchTools('   ', authToken)).rejects.toThrow(
        'Search query is required'
      );

      console.log('✅ Validation error correctly occurred with empty query');
    });
  });

  describe('Gateway connection check', () => {
    it('checkConnection() - Gateway connection is normal', async () => {
      console.log('🔗 Gateway connection check test started');

      const isConnected = await gatewayService.checkConnection(authToken);

      expect(isConnected).toBe(true);

      console.log('✅ Gateway connection check successful');
    });
  });
});
