import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { signOut } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import type { Submission } from '../../types/database';

export function HomePage() {
  const profile = useAuthStore((s) => s.profile);
  const appSession = useAuthStore((s) => s.appSession);
  const navigate = useNavigate();
  const [recentSubmissions, setRecentSubmissions] = useState<Submission[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(true);

  // Load recent submissions for this user
  useEffect(() => {
    const load = async () => {
      if (!profile) return;
      setLoadingSubs(true);
      const { data, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error && data) {
        setRecentSubmissions(data as Submission[]);
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
