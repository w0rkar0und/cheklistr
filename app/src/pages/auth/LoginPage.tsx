import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { signIn, createAppSession, fetchUserProfile, lookupOrganisation } from '../../lib/auth';
import { useAuthStore } from '../../stores/authStore';
import { Building2, User, Lock, LogIn, Loader2 } from 'lucide-react';

export function LoginPage() {
  const [orgSlug, setOrgSlug] = useState('');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { profile, isInitialised } = useAuthStore();
  const navigate = useNavigate();

  // Redirect if already authenticated
  useEffect(() => {
    if (isInitialised && profile) {
      const target = profile.role === 'admin' || profile.role === 'super_admin'
        ? '/admin'
        : '/';
      navigate(target, { replace: true });
    }
  }, [isInitialised, profile, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // 1. Validate organisation exists and is active
      const { data: org, error: orgError } = await lookupOrganisation(orgSlug);
      if (orgError || !org) {
        setError('Organisation not found. Check the Organisation ID and try again.');
        setLoading(false);
        return;
      }

      // 2. Authenticate with Supabase (org slug + User ID → synthetic email internally)
      const { data, error: signInError } = await signIn(loginId, orgSlug, password);
      if (signInError || !data.user) {
        setError('Invalid User ID or password');
        setLoading(false);
        return;
      }

      // 3. Fetch user profile
      const { data: userProfile, error: profileError } = await fetchUserProfile(data.user.id);
      if (profileError || !userProfile) {
        setError('Unable to load your profile. Contact an administrator.');
        setLoading(false);
        return;
      }

      // 4. Check account is active
      if (!userProfile.is_active) {
        setError('Your account has been deactivated. Contact an administrator.');
        setLoading(false);
        return;
      }

      // 5. Create app session (DB trigger terminates any existing sessions)
      const { data: appSession, error: sessionError } = await createAppSession(data.user.id, org.id);
      if (sessionError || !appSession) {
        console.error('Session creation warning:', sessionError);
      }

      // 6. Update store
      useAuthStore.getState().setAuthUser(data.user);
      useAuthStore.getState().setProfile(userProfile);
      useAuthStore.getState().setOrganisation(org);
      if (appSession) {
        useAuthStore.getState().setAppSession(appSession);
      }

      // 7. Navigate based on role
      const target = userProfile.role === 'admin' || userProfile.role === 'super_admin'
        ? '/admin'
        : '/';
      navigate(target, { replace: true });
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
        <img src="/cheklistr-logo.png" alt="Cheklistr" className="login-logo" />
        <p className="login-subtitle">Vehicle Inspection System</p>

        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="error-message">{error}</div>
          )}

          <div className="login-field">
            <label htmlFor="org-slug"><Building2 size={14} /> Organisation ID</label>
            <input
              id="org-slug"
              type="text"
              value={orgSlug}
              onChange={(e) => setOrgSlug(e.target.value.toLowerCase().trim())}
              placeholder=""
              required
              autoComplete="organization"
              autoCapitalize="none"
              disabled={loading}
            />
          </div>

          <div className="login-field">
            <label htmlFor="login-id"><User size={14} /> User ID</label>
            <input
              id="login-id"
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value.toUpperCase())}
              placeholder=""
              required
              autoComplete="username"
              autoCapitalize="characters"
              disabled={loading}
            />
          </div>

          <div className="login-field">
            <label htmlFor="password"><Lock size={14} /> Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder=""
              required
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="btn-primary btn-large"
            disabled={loading}
          >
            {loading ? <><Loader2 size={20} className="icon-spin" /> Signing in...</> : <><LogIn size={20} /> Sign In</>}
          </button>
        </form>
      </div>
    </div>
  );
}
