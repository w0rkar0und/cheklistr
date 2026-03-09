import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  signIn,
  createAppSession,
  fetchUserProfile,
  restoreSessionFromTokens,
} from '../../lib/auth';
import { useAuthStore } from '../../stores/authStore';
import { isNativePlatform } from '../../lib/capacitorPlatform';
import {
  checkBiometricAvailability,
  authenticateWithBiometric,
  getBiometricLabel,
} from '../../lib/biometricAuth';
import {
  isBiometricEnrolled,
  setBiometricEnrolled,
  getBiometricUserId,
} from '../../lib/secureStorage';
import { getAccessTokenFromStorage, SUPABASE_URL, SUPABASE_ANON_KEY } from '../../lib/supabase';

type LoginView = 'loading' | 'biometric' | 'credentials' | 'enrolling';

export function LoginPage() {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<LoginView>('loading');
  const [biometricLabel, setBiometricLabel] = useState('Biometric');

  const { profile, isInitialised } = useAuthStore();
  const navigate = useNavigate();

  // Redirect if already authenticated
  useEffect(() => {
    if (isInitialised && profile) {
      navigate(profile.role === 'admin' ? '/admin' : '/', { replace: true });
    }
  }, [isInitialised, profile, navigate]);

  // On mount: check for biometric enrolment on native
  useEffect(() => {
    const checkBiometric = async () => {
      if (!isNativePlatform()) {
        setView('credentials');
        return;
      }

      const enrolled = await isBiometricEnrolled();
      if (enrolled) {
        const availability = await checkBiometricAvailability();
        if (availability.available) {
          setBiometricLabel(getBiometricLabel(availability.biometryType));
          setView('biometric');
          // Auto-trigger biometric on launch
          handleBiometricUnlock();
          return;
        }
      }

      setView('credentials');
    };

    checkBiometric();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Biometric unlock (subsequent launches) ───────────────────

  const handleBiometricUnlock = async () => {
    setError(null);
    setLoading(true);

    try {
      const authenticated = await authenticateWithBiometric('Unlock Cheklistr');
      if (!authenticated) {
        setError('Biometric authentication failed');
        setLoading(false);
        return;
      }

      // Restore Supabase session from stored tokens
      const { success, userId } = await restoreSessionFromTokens();
      if (!success || !userId) {
        setError('Session expired — please sign in with your credentials');
        setView('credentials');
        setLoading(false);
        return;
      }

      // Check the stored user ID matches
      const storedUserId = await getBiometricUserId();
      if (storedUserId && storedUserId !== userId) {
        setError('Account mismatch — please sign in with your credentials');
        setView('credentials');
        setLoading(false);
        return;
      }

      // Fetch profile and create session
      await completeLogin(userId);
    } catch (err) {
      console.error('Biometric unlock error:', err);
      setError('Biometric unlock failed — please sign in with your credentials');
      setView('credentials');
    } finally {
      setLoading(false);
    }
  };

  // ── Credential login ─────────────────────────────────────────

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // 1. Authenticate with Supabase
      const { data, error: signInError } = await signIn(loginId, password);
      if (signInError || !data.user) {
        setError('Invalid User ID or password');
        setLoading(false);
        return;
      }

      // 2. On native: check biometric availability for mandatory enrolment
      if (isNativePlatform()) {
        const availability = await checkBiometricAvailability();
        if (availability.available) {
          setBiometricLabel(getBiometricLabel(availability.biometryType));
          setView('enrolling');

          // Mandatory enrolment: authenticate biometric now
          const enrolled = await authenticateWithBiometric(
            `Enable ${getBiometricLabel(availability.biometryType)} for Cheklistr`,
          );

          if (enrolled) {
            await setBiometricEnrolled(true, data.user.id);
          }
          // If biometric auth fails (e.g. cancelled), continue anyway
          // but don't set enrolled — they'll get the credential form next time
        }
      }

      // 3. Complete login
      await completeLogin(data.user.id);
    } catch (err) {
      console.error('Login error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Shared login completion ──────────────────────────────────

  const completeLogin = async (userId: string) => {
    // Fetch user profile
    const { data: userProfile, error: profileError } = await fetchUserProfile(userId);
    if (profileError || !userProfile) {
      setError('Unable to load your profile. Contact an administrator.');
      setView('credentials');
      return;
    }

    // Check account is active
    if (!userProfile.is_active) {
      setError('Your account has been deactivated. Contact an administrator.');
      setView('credentials');
      return;
    }

    // Create app session
    const { data: appSession, error: sessionError } = await createAppSession(userId);
    if (sessionError || !appSession) {
      console.error('Session creation warning:', sessionError);
    }

    // Update store — use raw fetch to get the auth user instead of
    // supabase.auth.getUser() which can hang in Capacitor WebView
    const store = useAuthStore.getState();
    try {
      const accessToken = getAccessTokenFromStorage();
      if (accessToken) {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${accessToken}`,
          },
        });
        if (res.ok) {
          const authUser = await res.json();
          store.setAuthUser(authUser);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch auth user (non-critical):', err);
    }
    store.setProfile(userProfile);
    if (appSession) {
      store.setAppSession(appSession);
    }

    // Navigate based on role
    navigate(userProfile.role === 'admin' ? '/admin' : '/', { replace: true });
  };

  // ── Render ───────────────────────────────────────────────────

  if (view === 'loading') {
    return (
      <div className="login-page">
        <div className="login-card">
          <h1>Cheklistr</h1>
          <p className="login-subtitle">Loading...</p>
        </div>
      </div>
    );
  }

  if (view === 'enrolling') {
    return (
      <div className="login-page">
        <div className="login-card">
          <h1>Cheklistr</h1>
          <p className="login-subtitle">Setting up {biometricLabel}...</p>
          <p className="login-biometric-hint">
            Authenticate with {biometricLabel} to enable fast unlock.
          </p>
        </div>
      </div>
    );
  }

  if (view === 'biometric') {
    return (
      <div className="login-page">
        <div className="login-card">
          <h1>Cheklistr</h1>
          <p className="login-subtitle">Vehicle Inspection System</p>

          {error && <div className="error-message">{error}</div>}

          <button
            type="button"
            className="btn-primary btn-large biometric-unlock-btn"
            onClick={handleBiometricUnlock}
            disabled={loading}
          >
            {loading ? 'Unlocking...' : `Unlock with ${biometricLabel}`}
          </button>

          <button
            type="button"
            className="btn-link"
            onClick={() => { setError(null); setView('credentials'); }}
            disabled={loading}
          >
            Use User ID &amp; Password instead
          </button>
        </div>
      </div>
    );
  }

  // Default: credentials view
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
