import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { signOut } from '../../lib/auth';

export function HomePage() {
  const profile = useAuthStore((s) => s.profile);
  const appSession = useAuthStore((s) => s.appSession);
  const navigate = useNavigate();

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

      {/* Drafts section - to be implemented */}
      <section className="home-section">
        <h3>Drafts</h3>
        <p className="empty-state">No saved drafts</p>
      </section>

      {/* Recent submissions - to be implemented */}
      <section className="home-section">
        <h3>Recent Submissions</h3>
        <p className="empty-state">No recent submissions</p>
      </section>

      {/* Pending uploads indicator - to be implemented */}

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
