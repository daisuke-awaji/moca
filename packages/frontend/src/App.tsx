import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './stores/authStore';
import { useSettingsStore } from './stores/settingsStore';
import { AuthContainer } from './features/auth/AuthContainer';
import { MainLayout } from './layouts/MainLayout';
import { HomePage } from './pages/HomePage';
import { ChatPage } from './pages/ChatPage';
import { ToolsPage } from './pages/ToolsPage';
import { AgentDirectoryPage } from './pages/AgentDirectoryPage';
import { SearchChatPage } from './pages/SearchChatPage';
import { AgentsPage } from './pages/AgentsPage';
import { EventsPage } from './pages/EventsPage';
import { SettingsPage } from './pages/SettingsPage';
import { getCurrentUserSession } from './lib/cognito';
import { useAgentStore } from './stores/agentStore';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initializeErrorHandler } from './utils/errorHandler';

function App() {
  const { user, isAuthenticated, setUser, setLoading, setError, logout } = useAuthStore();
  const { initializeStore, clearStore } = useAgentStore();
  const { theme } = useSettingsStore();

  // Initialize error handler and check existing session
  useEffect(() => {
    initializeErrorHandler({ logout });

    const checkExistingSession = async () => {
      try {
        setLoading(true);
        const existingUser = await getCurrentUserSession();

        if (existingUser) {
          setUser(existingUser);
        }
      } catch (error) {
        console.error('Session check error:', error);
      } finally {
        setLoading(false);
      }
    };

    checkExistingSession();
  }, [setUser, setLoading, setError, logout]);

  // Initialize AgentStore when user is authenticated
  useEffect(() => {
    if (user) {
      console.log('👤 User authenticated, initializing AgentStore...');
      initializeStore();
    } else {
      console.log('👋 User logged out, clearing AgentStore...');
      clearStore();
    }
  }, [user, initializeStore, clearStore]);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    
    const applyTheme = (isDark: boolean) => {
      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    if (theme === 'system') {
      // システム設定に連動
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mediaQuery.matches);

      // システム設定変更を監視
      const listener = (e: MediaQueryListEvent) => applyTheme(e.matches);
      mediaQuery.addEventListener('change', listener);

      return () => mediaQuery.removeEventListener('change', listener);
    } else {
      // 明示的なテーマ設定
      applyTheme(theme === 'dark');
    }
  }, [theme]);

  return (
    <ErrorBoundary>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#363636',
            color: '#fff',
            borderRadius: '12px',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      <BrowserRouter>
        {isAuthenticated ? (
          <div className="h-screen flex">
            <Routes>
              <Route element={<MainLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/chat/:sessionId" element={<ChatPage />} />
                <Route path="/search-chat" element={<SearchChatPage />} />
                <Route path="/search" element={<AgentDirectoryPage />} />
                <Route path="/tools" element={<ToolsPage />} />
                <Route path="/agents" element={<AgentsPage />} />
                <Route path="/events" element={<EventsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/chat" replace />} />
            </Routes>
          </div>
        ) : (
          <AuthContainer />
        )}
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
