import {
  CognitoUserPool,
  CognitoUser,
  CognitoUserAttribute,
  AuthenticationDetails,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';
import type { User } from '../types/index';

// Cognito error type definition
interface CognitoError extends Error {
  code?: string;
  name: string;
}

// Authentication result type definition
export interface AuthResult {
  type: 'success' | 'newPasswordRequired';
  user?: User;
  cognitoUser?: CognitoUser;
  userAttributes?: Record<string, string>;
}

// Re-export CognitoUser (for use as a type)
export type { CognitoUser };

// Cognito configuration (from environment variables)
const USER_POOL_ID = import.meta.env.VITE_COGNITO_USER_POOL_ID || '';
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID || '';
const AWS_REGION = import.meta.env.VITE_AWS_REGION || 'us-east-1';

// User Pool instance
const userPool = new CognitoUserPool({
  UserPoolId: USER_POOL_ID,
  ClientId: CLIENT_ID,
});

/**
 * Authenticate user
 * Returns cognitoUser for NEW_PASSWORD_REQUIRED challenge
 */
export const authenticateUser = async (username: string, password: string): Promise<AuthResult> => {
  return new Promise((resolve, reject) => {
    const authenticationDetails = new AuthenticationDetails({
      Username: username,
      Password: password,
    });

    const cognitoUser = new CognitoUser({
      Username: username,
      Pool: userPool,
    });

    cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess: (session: CognitoUserSession) => {
        const accessToken = session.getAccessToken().getJwtToken();
        const refreshToken = session.getRefreshToken().getToken();

        // Extract userId (sub) from accessToken
        let userId = '';
        try {
          const accessTokenPayload = JSON.parse(atob(accessToken.split('.')[1]));
          userId = accessTokenPayload.sub || '';
        } catch (error) {
          console.error('Failed to parse accessToken:', error);
        }

        const user: User = {
          userId,
          username,
          accessToken,
          refreshToken,
        };

        resolve({ type: 'success', user });
      },
      onFailure: (err) => {
        let errorMessage = 'Login failed';

        if (err.code === 'NotAuthorizedException') {
          errorMessage = 'Incorrect username or password';
        } else if (err.code === 'UserNotConfirmedException') {
          errorMessage = 'User is not confirmed';
        } else if (err.code === 'PasswordResetRequiredException') {
          errorMessage = 'Password reset required';
        } else if (err.code === 'UserNotFoundException') {
          errorMessage = 'User not found';
        } else if (err.message) {
          errorMessage = err.message;
        }

        reject(new Error(errorMessage));
      },
      newPasswordRequired: (userAttributes: Record<string, string>) => {
        // Remove read-only attributes (Cognito requirement)
        delete userAttributes.email_verified;
        delete userAttributes.phone_number_verified;

        resolve({
          type: 'newPasswordRequired',
          cognitoUser,
          userAttributes,
        });
      },
    });
  });
};

/**
 * Complete NEW_PASSWORD_REQUIRED challenge
 */
export const completeNewPasswordChallenge = async (
  cognitoUser: CognitoUser,
  newPassword: string,
  requiredAttributes?: Record<string, string>
): Promise<User> => {
  return new Promise((resolve, reject) => {
    cognitoUser.completeNewPasswordChallenge(newPassword, requiredAttributes || {}, {
      onSuccess: (session: CognitoUserSession) => {
        const accessToken = session.getAccessToken().getJwtToken();
        const refreshToken = session.getRefreshToken().getToken();

        // Extract userId (sub) from accessToken
        let userId = '';
        try {
          const accessTokenPayload = JSON.parse(atob(accessToken.split('.')[1]));
          userId = accessTokenPayload.sub || '';
        } catch (error) {
          console.error('Failed to parse accessToken:', error);
        }

        const user: User = {
          userId,
          username: cognitoUser.getUsername(),
          accessToken,
          refreshToken,
        };

        resolve(user);
      },
      onFailure: (err) => {
        let errorMessage = 'Failed to change password';

        const cognitoError = err as CognitoError;
        if (cognitoError.code === 'InvalidPasswordException') {
          errorMessage = 'Password does not meet requirements';
        } else if (cognitoError.code === 'InvalidParameterException') {
          errorMessage = 'Invalid input values';
        } else if (err.message) {
          errorMessage = err.message;
        }

        reject(new Error(errorMessage));
      },
    });
  });
};

/**
 * Sign out user
 */
export const signOutUser = async (): Promise<void> => {
  return new Promise((resolve) => {
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser) {
      cognitoUser.signOut();
    }
    resolve();
  });
};

/**
 * Get current user session
 */
export const getCurrentUserSession = async (): Promise<User | null> => {
  return new Promise((resolve) => {
    const cognitoUser = userPool.getCurrentUser();

    if (!cognitoUser) {
      resolve(null);
      return;
    }

    cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session || !session.isValid()) {
        resolve(null);
        return;
      }

      const accessToken = session.getAccessToken().getJwtToken();
      const refreshToken = session.getRefreshToken().getToken();

      // Extract userId (sub) from accessToken
      let userId = '';
      try {
        const accessTokenPayload = JSON.parse(atob(accessToken.split('.')[1]));
        userId = accessTokenPayload.sub || '';
      } catch (error) {
        console.error('Failed to parse accessToken:', error);
      }

      const user: User = {
        userId,
        username: cognitoUser.getUsername(),
        accessToken,
        refreshToken,
      };

      resolve(user);
    });
  });
};

/**
 * Refresh tokens
 */
export const refreshTokens = async (): Promise<User | null> => {
  return new Promise((resolve, reject) => {
    const cognitoUser = userPool.getCurrentUser();

    if (!cognitoUser) {
      resolve(null);
      return;
    }

    cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session) {
        reject(new Error('Failed to get session'));
        return;
      }

      const refreshToken = session.getRefreshToken();

      cognitoUser.refreshSession(refreshToken, (refreshErr, newSession) => {
        if (refreshErr) {
          reject(new Error('Failed to refresh token'));
          return;
        }

        const accessToken = newSession.getAccessToken().getJwtToken();
        const newRefreshToken = newSession.getRefreshToken().getToken();

        // Extract userId (sub) from accessToken
        let userId = '';
        try {
          const accessTokenPayload = JSON.parse(atob(accessToken.split('.')[1]));
          userId = accessTokenPayload.sub || '';
        } catch (error) {
          console.error('Failed to parse accessToken:', error);
        }

        const user: User = {
          userId,
          username: cognitoUser.getUsername(),
          accessToken,
          refreshToken: newRefreshToken,
        };

        resolve(user);
      });
    });
  });
};

/**
 * Get valid access token (auto-refreshes if expired)
 * getSession() internally checks expiration and auto-refreshes
 */
export const getValidAccessToken = async (): Promise<string | null> => {
  return new Promise((resolve) => {
    const cognitoUser = userPool.getCurrentUser();

    if (!cognitoUser) {
      console.warn('🔒 No authenticated user found');
      resolve(null);
      return;
    }

    // getSession() internally checks expiration and auto-refreshes
    cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err) {
        // Check if error is related to refresh token expiration
        const cognitoErr = err as CognitoError;
        if (
          cognitoErr.code === 'NotAuthorizedException' ||
          cognitoErr.message?.includes('refresh')
        ) {
          console.warn('🔒 Refresh token expired:', err.message);
        } else {
          console.warn('🔒 Session retrieval error:', err.message);
        }
        resolve(null);
        return;
      }

      if (!session || !session.isValid()) {
        console.warn('🔒 Invalid session');
        resolve(null);
        return;
      }

      const accessToken = session.getAccessToken().getJwtToken();
      console.log('✅ Valid access token obtained');
      resolve(accessToken);
    });
  });
};

/**
 * Get valid user info (auto-refreshes if expired)
 */
export const getValidUser = async (): Promise<User | null> => {
  return new Promise((resolve) => {
    const cognitoUser = userPool.getCurrentUser();

    if (!cognitoUser) {
      resolve(null);
      return;
    }

    cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session || !session.isValid()) {
        resolve(null);
        return;
      }

      const accessToken = session.getAccessToken().getJwtToken();

      // Extract userId (sub) from accessToken
      let userId = '';
      try {
        const accessTokenPayload = JSON.parse(atob(accessToken.split('.')[1]));
        userId = accessTokenPayload.sub || '';
      } catch (error) {
        console.error('Failed to parse accessToken:', error);
      }

      const user: User = {
        userId,
        username: cognitoUser.getUsername(),
        accessToken,
        refreshToken: session.getRefreshToken().getToken(),
      };

      resolve(user);
    });
  });
};

/**
 * Sign up a new user
 */
export const signUpUser = async (
  username: string,
  password: string,
  email: string
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const attributeList = [
      new CognitoUserAttribute({
        Name: 'email',
        Value: email,
      }),
    ];

    userPool.signUp(username, password, attributeList, [], (err) => {
      if (err) {
        let errorMessage = 'Sign up failed';

        const cognitoError = err as CognitoError;
        if (cognitoError.code === 'UsernameExistsException') {
          errorMessage = 'This username is already taken';
        } else if (cognitoError.code === 'InvalidPasswordException') {
          errorMessage = 'Password does not meet requirements';
        } else if (cognitoError.code === 'InvalidParameterException') {
          errorMessage = 'Invalid input values';
        } else if (err.message) {
          errorMessage = err.message;
        }

        reject(new Error(errorMessage));
        return;
      }

      resolve();
    });
  });
};

/**
 * Verify sign up confirmation code
 */
export const confirmSignUp = async (username: string, code: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({
      Username: username,
      Pool: userPool,
    });

    cognitoUser.confirmRegistration(code, true, (err) => {
      if (err) {
        let errorMessage = 'Confirmation failed';

        const cognitoError = err as CognitoError;
        if (cognitoError.code === 'CodeMismatchException') {
          errorMessage = 'Incorrect confirmation code';
        } else if (cognitoError.code === 'ExpiredCodeException') {
          errorMessage = 'Confirmation code has expired';
        } else if (cognitoError.code === 'UserNotFoundException') {
          errorMessage = 'User not found';
        } else if (err.message) {
          errorMessage = err.message;
        }

        reject(new Error(errorMessage));
        return;
      }

      resolve();
    });
  });
};

/**
 * Resend confirmation code
 */
export const resendConfirmationCode = async (username: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({
      Username: username,
      Pool: userPool,
    });

    cognitoUser.resendConfirmationCode((err) => {
      if (err) {
        let errorMessage = 'Failed to resend confirmation code';

        const cognitoError = err as CognitoError;
        if (cognitoError.code === 'UserNotFoundException') {
          errorMessage = 'User not found';
        } else if (cognitoError.code === 'InvalidParameterException') {
          errorMessage = 'User is already confirmed';
        } else if (err.message) {
          errorMessage = err.message;
        }

        reject(new Error(errorMessage));
        return;
      }

      resolve();
    });
  });
};

/**
 * Initiate password reset (sends confirmation code)
 */
export const forgotPassword = async (username: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({
      Username: username,
      Pool: userPool,
    });

    cognitoUser.forgotPassword({
      onSuccess: () => {
        resolve();
      },
      onFailure: (err) => {
        let errorMessage = 'Failed to initiate password reset';

        const cognitoError = err as CognitoError;
        if (cognitoError.code === 'UserNotFoundException') {
          errorMessage = 'User not found';
        } else if (cognitoError.code === 'InvalidParameterException') {
          errorMessage = 'Invalid input values';
        } else if (cognitoError.code === 'LimitExceededException') {
          errorMessage = 'Attempt limit exceeded. Please try again later';
        } else if (err.message) {
          errorMessage = err.message;
        }

        reject(new Error(errorMessage));
      },
    });
  });
};

/**
 * Confirm password reset (with confirmation code and new password)
 */
export const confirmResetPassword = async (
  username: string,
  verificationCode: string,
  newPassword: string
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({
      Username: username,
      Pool: userPool,
    });

    cognitoUser.confirmPassword(verificationCode, newPassword, {
      onSuccess: () => {
        resolve();
      },
      onFailure: (err) => {
        let errorMessage = 'Failed to reset password';

        const cognitoError = err as CognitoError;
        if (cognitoError.code === 'CodeMismatchException') {
          errorMessage = 'Incorrect confirmation code';
        } else if (cognitoError.code === 'ExpiredCodeException') {
          errorMessage = 'Confirmation code has expired';
        } else if (cognitoError.code === 'InvalidPasswordException') {
          errorMessage = 'Password does not meet requirements';
        } else if (cognitoError.code === 'UserNotFoundException') {
          errorMessage = 'User not found';
        } else if (err.message) {
          errorMessage = err.message;
        }

        reject(new Error(errorMessage));
      },
    });
  });
};

/**
 * Get Cognito configuration
 */
export const getCognitoConfig = () => ({
  userPoolId: USER_POOL_ID,
  clientId: CLIENT_ID,
  region: AWS_REGION,
});
