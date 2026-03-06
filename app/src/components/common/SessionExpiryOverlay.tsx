import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { signIn, createAppSession, fetchUserProfile } from '../../lib/auth';
import { useAuthStore } from '../../stores/authStore';

/**
 * Full-screen overlay that appears when the 2-hour app session expires.
 * The user must re-enter their password (and eventually provide a selfie)
 * to continue working. Drafts are preserved in IndexedDB regardless.
 */
export function SessionExpiryOverlay() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const profile = useAuthStore((s) => s.profile);
  const navigate = useNavigate();

  const handleReauth = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setError(null);
    setLoading(true);

    try {
      // Re-authenticate with the same User ID
      const { data, error: signInError } = await signIn(profile.login_id, password);
      if (signInError || !data.user) {
        setError(signInError?.message ?? 'Re-authentication failed');
        setLoading(false);
        return;
      }

      // Refresh profile (in case it was updated)
      const { data: freshProfile } = await fetchUserProfile(data.user.id);
      if (freshProfile) {
        useAuthStore.getState().setProfile(freshProfile);
      }

      // Create a new app session
      const { data: newSession } = await createAppSession(data.user.id);
      if (newSession) {
        useAuthStore.getState().setAppSession(newSession);
      }

      // Clear the expired flag
      useAuthStore.getState().setSessionExpired(false);
      setPassword('');
    } catch (err) {
      console.error('Re-auth error:', err);
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleFullSignOut = async () => {
    useAuthStore.getState().reset();
    navigate('/login', { replace: true });
  };

  return (
    <div className="session-expiry-overlay">
      <div className="session-expiry-card">
        <div className="session-expiry-icon">&#9200;</div>
        <h2>Session Expired</h2>
        <p className="session-expiry-message">
          Your session has expired for security. Please re-enter your password to continue.
        </p>
        <p className="session-expiry-reassurance">
          Your work has been saved locally.
        </p>

        <form onSubmit={handleReauth} className="login-form">
          {error && (
            <div className="error-message">{error}</div>
          )}

          <label htmlFor="reauth-user-id">User ID</label>
          <input
            id="reauth-user-id"
            type="text"
            value={profile?.login_id ?? ''}
            disabled
          />

          <label htmlFor="reauth-password">Password</label>
          <input
            id="reauth-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
            autoComplete="current-password"
            autoFocus
            disabled={loading}
          />

          <button
            type="submit"
            className="btn-primary btn-large"
            disabled={loading}
          >
            {loading ? 'Verifying...' : 'Continue Session'}
          </button>
        </form>

        <button
          className="btn-secondary"
          onClick={handleFullSignOut}
          style={{ width: '100%', marginTop: '0.5rem' }}
          disabled={loading}
        >
          Sign Out Instead
        </button>
      </div>
    </div>
  );
}
