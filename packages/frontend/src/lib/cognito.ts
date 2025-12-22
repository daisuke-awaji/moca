import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';
import type { User } from '../types/index';

// Cognito設定（環境変数から取得）
const USER_POOL_ID = import.meta.env.VITE_COGNITO_USER_POOL_ID || '';
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID || '';
const AWS_REGION = import.meta.env.VITE_AWS_REGION || 'us-east-1';

// User Pool インスタンス
const userPool = new CognitoUserPool({
  UserPoolId: USER_POOL_ID,
  ClientId: CLIENT_ID,
});

/**
 * ユーザー認証を行う
 */
export const authenticateUser = async (username: string, password: string): Promise<User> => {
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
        const idToken = session.getIdToken().getJwtToken();

        const user: User = {
          username,
          accessToken,
          refreshToken,
          idToken,
        };

        resolve(user);
      },
      onFailure: (err) => {
        let errorMessage = 'ログインに失敗しました';

        if (err.code === 'NotAuthorizedException') {
          errorMessage = 'ユーザー名またはパスワードが間違っています';
        } else if (err.code === 'UserNotConfirmedException') {
          errorMessage = 'ユーザーが確認されていません';
        } else if (err.code === 'PasswordResetRequiredException') {
          errorMessage = 'パスワードのリセットが必要です';
        } else if (err.code === 'UserNotFoundException') {
          errorMessage = 'ユーザーが見つかりません';
        } else if (err.message) {
          errorMessage = err.message;
        }

        reject(new Error(errorMessage));
      },
    });
  });
};

/**
 * ユーザーをサインアウトする
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
 * 現在のユーザーセッションを取得する
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
      const idToken = session.getIdToken().getJwtToken();

      const user: User = {
        username: cognitoUser.getUsername(),
        accessToken,
        refreshToken,
        idToken,
      };

      resolve(user);
    });
  });
};

/**
 * トークンを更新する
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
        reject(new Error('セッションの取得に失敗しました'));
        return;
      }

      const refreshToken = session.getRefreshToken();

      cognitoUser.refreshSession(refreshToken, (refreshErr, newSession) => {
        if (refreshErr) {
          reject(new Error('トークンの更新に失敗しました'));
          return;
        }

        const accessToken = newSession.getAccessToken().getJwtToken();
        const newRefreshToken = newSession.getRefreshToken().getToken();
        const idToken = newSession.getIdToken().getJwtToken();

        const user: User = {
          username: cognitoUser.getUsername(),
          accessToken,
          refreshToken: newRefreshToken,
          idToken,
        };

        resolve(user);
      });
    });
  });
};

/**
 * Cognito設定を取得する
 */
export const getCognitoConfig = () => ({
  userPoolId: USER_POOL_ID,
  clientId: CLIENT_ID,
  region: AWS_REGION,
});
