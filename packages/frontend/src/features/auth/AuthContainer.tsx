import React, { useEffect } from 'react';
import { Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { LoginForm } from './LoginForm';
import { SignUpForm } from './SignUpForm';
import { ConfirmSignUpForm } from './ConfirmSignUpForm';

export const AuthContainer: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { needsConfirmation, pendingUsername, setNeedsConfirmation } = useAuthStore();

  // 確認が必要な場合は /confirm へリダイレクト
  useEffect(() => {
    if (needsConfirmation && pendingUsername && location.pathname !== '/confirm') {
      navigate('/confirm', { replace: true });
    }
  }, [needsConfirmation, pendingUsername, location.pathname, navigate]);

  const handleSwitchToLogin = () => {
    setNeedsConfirmation(false);
    navigate('/login');
  };

  const handleSwitchToSignUp = () => {
    setNeedsConfirmation(false);
    navigate('/signup');
  };

  const handleBackToSignUp = () => {
    setNeedsConfirmation(false);
    navigate('/signup');
  };

  return (
    <Routes>
      <Route path="/login" element={<LoginForm onSwitchToSignUp={handleSwitchToSignUp} />} />
      <Route path="/signup" element={<SignUpForm onSwitchToLogin={handleSwitchToLogin} />} />
      <Route
        path="/confirm"
        element={
          <ConfirmSignUpForm
            username={pendingUsername || ''}
            onSwitchToLogin={handleSwitchToLogin}
            onBack={handleBackToSignUp}
          />
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};
