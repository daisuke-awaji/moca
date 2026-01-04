/**
 * Cognito Authentication Helper (for testing)
 */

import { AuthenticationDetails, CognitoUser, CognitoUserPool } from 'amazon-cognito-identity-js';

export interface CognitoConfig {
  userPoolId: string;
  clientId: string;
  region: string;
}

export interface AuthResult {
  idToken: string;
  accessToken: string;
  refreshToken: string;
}

/**
 * Cognito authentication helper class
 */
export class CognitoAuthHelper {
  private userPool: CognitoUserPool;

  constructor(private config: CognitoConfig) {
    this.userPool = new CognitoUserPool({
      UserPoolId: config.userPoolId,
      ClientId: config.clientId,
    });
  }

  /**
   * User login
   */
  async login(username: string, password: string): Promise<AuthResult> {
    return new Promise((resolve, reject) => {
      const authenticationDetails = new AuthenticationDetails({
        Username: username,
        Password: password,
      });

      const cognitoUser = new CognitoUser({
        Username: username,
        Pool: this.userPool,
      });

      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: (result) => {
          const idToken = result.getIdToken().getJwtToken();
          const accessToken = result.getAccessToken().getJwtToken();
          const refreshToken = result.getRefreshToken().getToken();

          console.log('✅ Cognito authentication successful:', {
            username,
            idTokenLength: idToken.length,
            accessTokenLength: accessToken.length,
          });

          resolve({
            idToken,
            accessToken,
            refreshToken,
          });
        },
        onFailure: (err) => {
          console.error('❌ Cognito authentication failed:', err);
          reject(err);
        },
        newPasswordRequired: (userAttributes, requiredAttributes) => {
          console.log('🔐 New password required:', {
            userAttributes,
            requiredAttributes,
          });
          reject(new Error('New password is required'));
        },
      });
    });
  }

  /**
   * JWT token decoding (for debugging)
   */
  decodeJWT(token: string): Record<string, unknown> | null {
    try {
      const parts = token.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      return payload;
    } catch (error) {
      console.error('JWT decoding error:', error);
      return null;
    }
  }

  /**
   * JWT token expiration check
   */
  isTokenExpired(token: string): boolean {
    const payload = this.decodeJWT(token);
    if (!payload || !payload.exp || typeof payload.exp !== 'number') return true;

    const now = Math.floor(Date.now() / 1000);
    return payload.exp < now;
  }
}
