import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { AuthState, User } from '../types/index';
import {
  authenticateUser,
  signOutUser,
  signUpUser,
  confirmSignUp,
  resendConfirmationCode,
  completeNewPasswordChallenge,
  type CognitoUser,
} from '../lib/cognito';
import { logger } from '../utils/logger';
import { extractErrorMessage } from '../utils/store-helpers';

interface AuthActions {
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signUp: (username: string, password: string, email: string) => Promise<void>;
  confirmSignUp: (username: string, code: string) => Promise<void>;
  resendCode: (username: string) => Promise<void>;
  completeNewPassword: (newPassword: string) => Promise<void>;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  setNeedsConfirmation: (needs: boolean, username?: string) => void;
  setNeedsNewPassword: (needs: boolean, cognitoUser?: CognitoUser) => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      (set, get) => ({
        // State
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        needsConfirmation: false,
        pendingUsername: null,
        needsNewPassword: false,
        pendingCognitoUser: null,

        // Actions
        login: async (username: string, password: string) => {
          try {
            set({ isLoading: true, error: null });

            const result = await authenticateUser(username, password);

            if (result.type === 'newPasswordRequired') {
              set({
                needsNewPassword: true,
                pendingCognitoUser: result.cognitoUser,
                isLoading: false,
                error: null,
              });
              return;
            }

            set({
              user: result.user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          } catch (error) {
            const errorMessage = extractErrorMessage(error, 'Authentication failed');
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
              error: errorMessage,
            });
            throw error;
          }
        },

        logout: async () => {
          try {
            set({ isLoading: true });

            const { user } = get();
            if (user) {
              await signOutUser();
            }

            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
              error: null,
              needsNewPassword: false,
              pendingCognitoUser: null,
            });
          } catch (error) {
            logger.error('Logout error:', error);
            // Clear state even on logout error
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
              error: null,
              needsNewPassword: false,
              pendingCognitoUser: null,
            });
          }
        },

        setUser: (user: User | null) => {
          set({
            user,
            isAuthenticated: !!user,
          });
        },

        setLoading: (loading: boolean) => {
          set({ isLoading: loading });
        },

        setError: (error: string | null) => {
          set({ error });
        },

        signUp: async (username: string, password: string, email: string) => {
          try {
            set({ isLoading: true, error: null });

            await signUpUser(username, password, email);

            set({
              isLoading: false,
              error: null,
              needsConfirmation: true,
              pendingUsername: username,
            });
          } catch (error) {
            const errorMessage = extractErrorMessage(error, 'Sign up failed');
            set({
              isLoading: false,
              error: errorMessage,
              needsConfirmation: false,
              pendingUsername: null,
            });
            throw error;
          }
        },

        confirmSignUp: async (username: string, code: string) => {
          try {
            set({ isLoading: true, error: null });

            await confirmSignUp(username, code);

            set({
              isLoading: false,
              error: null,
              needsConfirmation: false,
              pendingUsername: null,
            });
          } catch (error) {
            const errorMessage = extractErrorMessage(error, 'Confirmation failed');
            set({
              isLoading: false,
              error: errorMessage,
            });
            throw error;
          }
        },

        resendCode: async (username: string) => {
          try {
            set({ isLoading: true, error: null });

            await resendConfirmationCode(username);

            set({
              isLoading: false,
              error: null,
            });
          } catch (error) {
            const errorMessage = extractErrorMessage(error, 'Failed to resend code');
            set({
              isLoading: false,
              error: errorMessage,
            });
            throw error;
          }
        },

        completeNewPassword: async (newPassword: string) => {
          const { pendingCognitoUser } = get();
          if (!pendingCognitoUser) {
            throw new Error('Password change session not found');
          }

          try {
            set({ isLoading: true, error: null });

            const user = await completeNewPasswordChallenge(
              pendingCognitoUser as CognitoUser,
              newPassword
            );

            set({
              user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
              needsNewPassword: false,
              pendingCognitoUser: null,
            });
          } catch (error) {
            const errorMessage = extractErrorMessage(error, 'Failed to change password');
            set({
              isLoading: false,
              error: errorMessage,
            });
            throw error;
          }
        },

        setNeedsConfirmation: (needs: boolean, username?: string) => {
          set({
            needsConfirmation: needs,
            pendingUsername: username || null,
          });
        },

        setNeedsNewPassword: (needs: boolean, cognitoUser?: CognitoUser) => {
          set({
            needsNewPassword: needs,
            pendingCognitoUser: cognitoUser || null,
          });
        },

        clearError: () => {
          set({ error: null });
        },
      }),
      {
        name: 'agentcore-auth',
        partialize: (state) => ({
          user: state.user,
          isAuthenticated: state.isAuthenticated,
          needsConfirmation: state.needsConfirmation,
          pendingUsername: state.pendingUsername,
          // Note: needsNewPassword and pendingCognitoUser are NOT persisted
          // because CognitoUser instance is not serializable
        }),
      }
    ),
    {
      name: 'auth-store',
      enabled: import.meta.env.DEV,
    }
  )
);
