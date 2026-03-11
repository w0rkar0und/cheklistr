import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
// useChecklistStore not needed here — draft is loaded in NewChecklistPage from IndexedDB
import { signOut } from '../../lib/auth';
import { SUPABASE_URL, SUPABASE_ANON_KEY, getFreshAccessToken } from '../../lib/supabase';
import { getPendingCount, getDraft, deleteDraft } from '../../lib/offlineDb';
import type { DraftFormState } from '../../lib/offlineDb';
import type { Submission } from '../../types/database';
import { ClipboardPlus, LogOut, Play, Trash2, ChevronRight, FileCheck } from 'lucide-react';

export function HomePage() {
  const profile = useAuthStore((s) => s.profile);
  const appSession = useAuthStore((s) => s.appSession);
  const navigate = useNavigate();
  const location = useLocation();
  const [recentSubmissions, setRecentSubmissions] = useState<Submission[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [offlineSavedMsg, setOfflineSavedMsg] = useState(false);
  const [draftSavedMsg, setDraftSavedMsg] = useState(false);
  const [draft, setDraft] = useState<DraftFormState | null>(null);

  // Check for navigation state messages (offline-saved, draft-saved)
  useEffect(() => {
    const state = location.state as { offlineSaved?: boolean; draftSaved?: boolean } | null;
    if (state?.offlineSaved) {
      setOfflineSavedMsg(true);
      window.history.replaceState({}, '');
      setTimeout(() => setOfflineSavedMsg(false), 5000);
    }
    if (state?.draftSaved) {
      setDraftSavedMsg(true);
      window.history.replaceState({}, '');
      setTimeout(() => setDraftSavedMsg(false), 5000);
    }
  }, [location.state]);

  // Load pending submission count and check for saved draft
  useEffect(() => {
    const loadPending = async () => {
      try {
        const count = await getPendingCount();
        setPendingCount(count);
      } catch {
        // IndexedDB might not be available
      }
    };
    const loadDraft = async () => {
      try {
        const saved = await getDraft();
        setDraft(saved ?? null);
      } catch {
        // IndexedDB might not be available
      }
    };
    loadPending();
    loadDraft();
  }, []);

  // Load recent submissions for this user via raw fetch
  // (bypasses supabase JS client which can hang during token refresh in WebView)
  useEffect(() => {
    const load = async () => {
      if (!profile) return;
      setLoadingSubs(true);
      try {
        const accessToken = await getFreshAccessToken();
        if (!accessToken) {
          setLoadingSubs(false);
          return;
        }

        const url = `${SUPABASE_URL}/rest/v1/submissions?user_id=eq.${profile.id}&order=created_at.desc&limit=10`;
        const res = await fetch(url, {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
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

  const handleResumeDraft = () => {
    if (!draft) return;
    // Navigate to form — NewChecklistPage will load draft directly from IndexedDB
    navigate('/checklist/new', { state: { resumedDraft: true } });
  };

  const handleDiscardDraft = async () => {
    try {
      await deleteDraft();
      setDraft(null);
    } catch {
      console.error('[HOME] Failed to delete draft');
    }
  };

  const handleSignOut = () => {
    // Clear local state and navigate immediately — don't block on Supabase calls
    // which can hang in the Capacitor WebView during token refresh
    signOut(appSession?.id).catch(() => {});
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

      {draftSavedMsg && (
        <div className="success-message">
          Draft saved — you can resume it anytime.
        </div>
      )}

      {draft && (
        <div className="draft-card">
          <div className="draft-card-top">
            <span className="draft-badge">Draft</span>
            <span className="draft-vrm">
              {draft.vehicleInfo.vehicleRegistration || 'No VRM'}
            </span>
          </div>
          <div className="draft-card-details">
            {draft.driverInfo.name && <span>{draft.driverInfo.name}</span>}
            {draft.driverInfo.hrCode && (
              <span className="td-secondary"> ({draft.driverInfo.hrCode})</span>
            )}
          </div>
          <div className="draft-card-meta">
            <span>
              Saved {new Date(draft.savedAt).toLocaleString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
          <div className="draft-card-actions">
            <button className="btn-primary btn-small" onClick={handleResumeDraft}>
              <Play size={14} /> Resume
            </button>
            <button className="btn-danger btn-small" onClick={handleDiscardDraft}>
              <Trash2 size={14} /> Discard
            </button>
          </div>
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
          <ChevronRight size={20} className="pending-badge-arrow" />
        </button>
      )}

      <button
        className="btn-primary btn-large"
        onClick={handleNewChecklist}
      >
        <ClipboardPlus size={20} /> New Vehicle Inspection
      </button>

      {/* Recent submissions */}
      <section className="home-section">
        <h3><FileCheck size={18} /> Recent Submissions</h3>
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
        <LogOut size={18} /> Sign Out
      </button>
    </div>
  );
}
