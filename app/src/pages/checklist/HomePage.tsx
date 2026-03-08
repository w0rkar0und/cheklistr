import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { signOut } from '../../lib/auth';
import { SUPABASE_URL, SUPABASE_ANON_KEY, getAccessTokenFromStorage } from '../../lib/supabase';
import { getPendingCount } from '../../lib/offlineDb';
import type { Submission } from '../../types/database';

export function HomePage() {
  const profile = useAuthStore((s) => s.profile);
  const appSession = useAuthStore((s) => s.appSession);
  const navigate = useNavigate();
  const location = useLocation();
  const [recentSubmissions, setRecentSubmissions] = useState<Submission[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [offlineSavedMsg, setOfflineSavedMsg] = useState(false);

  // Check for offline-saved navigation state
  useEffect(() => {
    const state = location.state as { offlineSaved?: boolean } | null;
    if (state?.offlineSaved) {
      setOfflineSavedMsg(true);
      // Clear the state so it doesn't show again on refresh
      window.history.replaceState({}, '');
      setTimeout(() => setOfflineSavedMsg(false), 5000);
    }
  }, [location.state]);

  // Load pending submission count
  useEffect(() => {
    const loadPending = async () => {
      try {
        const count = await getPendingCount();
        setPendingCount(count);
      } catch {
        // IndexedDB might not be available
      }
    };
    loadPending();
  }, []);

  // Load recent submissions for this user (raw fetch — supabase client
  // can hang in Capacitor WebView when its auth session is stale)
  useEffect(() => {
    const load = async () => {
      if (!profile) return;
      setLoadingSubs(true);

      try {
        const accessToken = getAccessTokenFromStorage();
        if (!accessToken) {
          setLoadingSubs(false);
          return;
        }

        const url = `${SUPABASE_URL}/rest/v1/submissions?user_id=eq.${encodeURIComponent(profile.id)}&order=created_at.desc&limit=10&select=*`;
        const res = await fetch(url, {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          setRecentSubmissions(data as Submission[]);
        }
      } catch (err) {
        console.error('[HOME] Failed to load submissions:', err);
      }

      setLoadingSubs(false);
    };
    load();
  }, [profile]);

  const handleNewChecklist = () => {
    navigate('/checklist/new');
  };

  const handleSignOut = async () => {
    await signOut(appSession?.id);
    useAuthStore.getState().reset();
    navigate('/login', { replace: true });
  };

  return (
    <div className="home-page">
      <div className="home-greeting">
        <h2>Welcome, {profile?.full_name}</h2>
        <p className="home-meta">
          {profile?.contractor_id && <span>{profile.contractor_id}</span>}
          {profile?.contractor_id && profile?.site_code && <span> &middot; </span>}
          {profile?.site_code && <span>{profile.site_code}</span>}
        </p>
      </div>

      {offlineSavedMsg && (
        <div className="success-message">
          Submission saved offline — sync when you have signal.
        </div>
      )}

      {pendingCount > 0 && (
        <button
          className="pending-badge-card"
          onClick={() => navigate('/pending')}
        >
          <span className="pending-badge-count">{pendingCount}</span>
          <span className="pending-badge-text">
            submission{pendingCount !== 1 ? 's' : ''} pending sync
          </span>
          <span className="pending-badge-arrow">→</span>
        </button>
      )}

      <button
        className="btn-primary btn-large"
        onClick={handleNewChecklist}
      >
        New Vehicle Inspection
      </button>

      {/* Recent submissions */}
      <section className="home-section">
        <h3>Recent Submissions</h3>
        {loadingSubs ? (
          <p className="empty-state">Loading…</p>
        ) : recentSubmissions.length === 0 ? (
          <p className="empty-state">No recent submissions</p>
        ) : (
          <div className="submission-list">
            {recentSubmissions.map((sub) => (
              <div key={sub.id} className="submission-card">
                <div className="submission-card-top">
                  <span className="submission-vrm">{sub.vehicle_registration}</span>
                  <span className={`status-badge status-badge--${sub.status}`}>
                    {sub.status}
                  </span>
                </div>
                <div className="submission-card-details">
                  {sub.contractor_name && (
                    <span>{sub.contractor_name}</span>
                  )}
                  {sub.contractor_id && (
                    <span className="td-secondary"> ({sub.contractor_id})</span>
                  )}
                </div>
                <div className="submission-card-meta">
                  {sub.ts_form_submitted
                    ? new Date(sub.ts_form_submitted).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—'}
                  {sub.defect_summary && (
                    <span className="submission-defects">{sub.defect_summary}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <button
        className="btn-secondary"
        onClick={handleSignOut}
        style={{ width: '100%' }}
      >
        Sign Out
      </button>
    </div>
  );
}
