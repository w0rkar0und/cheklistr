import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { signIn, createAppSession, fetchUserProfile } from '../../lib/auth';
import { useAuthStore } from '../../stores/authStore';

export function LoginPage() {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { profile, isInitialised } = useAuthStore();
  const navigate = useNavigate();

  // Redirect if already authenticated
  useEffect(() => {
    if (isInitialised && profile) {
      navigate(profile.role === 'admin' ? '/admin' : '/', { replace: true });
    }
  }, [isInitialised, profile, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // 1. Authenticate with Supabase (User ID → synthetic email internally)
      const { data, error: signInError } = await signIn(loginId, password);
      if (signInError || !data.user) {
        setError('Invalid User ID or password');
        setLoading(false);
        return;
      }

      // 2. Fetch user profile
      const { data: userProfile, error: profileError } = await fetchUserProfile(data.user.id);
      if (profileError || !userProfile) {
        setError('Unable to load your profile. Contact an administrator.');
        setLoading(false);
        return;
      }

      // 3. Check account is active
      if (!userProfile.is_active) {
        setError('Your account has been deactivated. Contact an administrator.');
        setLoading(false);
        return;
      }

      // 4. Create app session (DB trigger terminates any existing sessions)
      const { data: appSession, error: sessionError } = await createAppSession(data.user.id);
      if (sessionError || !appSession) {
        console.error('Session creation warning:', sessionError);
      }

      // 5. Update store
      useAuthStore.getState().setAuthUser(data.user);
      useAuthStore.getState().setProfile(userProfile);
      if (appSession) {
        useAuthStore.getState().setAppSession(appSession);
      }

      // 6. Navigate based on role
      navigate(userProfile.role === 'admin' ? '/admin' : '/', { replace: true });
    } catch (err) {
      console.error('Login error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Cheklistr</h1>
        <p className="login-subtitle">Vehicle Inspection System</p>

        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="error-message">{error}</div>
          )}

          <label htmlFor="login-id">User ID</label>
          <input
            id="login-id"
            type="text"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value.toUpperCase())}
            placeholder="e.g. X123456"
            required
            autoComplete="username"
            autoCapitalize="characters"
            disabled={loading}
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
            autoComplete="current-password"
            disabled={loading}
          />

          <button
            type="submit"
            className="btn-primary btn-large"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
