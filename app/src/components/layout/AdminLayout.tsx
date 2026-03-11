import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { signOut } from '../../lib/auth';
import { LayoutDashboard, FileText, ClipboardCheck, Users, Clock, Building2, User, LogOut } from 'lucide-react';

export function AdminLayout() {
  const profile = useAuthStore((s) => s.profile);
  const organisation = useAuthStore((s) => s.organisation);
  const appSession = useAuthStore((s) => s.appSession);
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut(appSession?.id);
    useAuthStore.getState().reset();
    navigate('/login', { replace: true });
  };

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="sidebar-header">
          {organisation?.logo_url ? (
            <img
              src={organisation.logo_url}
              alt={organisation.name}
              className="sidebar-logo"
            />
          ) : (
            <h2>{organisation?.name ?? 'Cheklistr'}</h2>
          )}
          <span className="sidebar-badge">
            {profile?.role === 'super_admin' ? 'Super Admin' : 'Admin'}
          </span>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/admin" end><LayoutDashboard size={18} /> Dashboard</NavLink>
          <NavLink to="/admin/submissions"><FileText size={18} /> Submissions</NavLink>
          <NavLink to="/admin/checklists"><ClipboardCheck size={18} /> Checklists</NavLink>
          <NavLink to="/admin/users"><Users size={18} /> Users</NavLink>
          <NavLink to="/admin/sessions"><Clock size={18} /> Sessions</NavLink>
          {profile?.role === 'super_admin' && (
            <NavLink to="/admin/organisations"><Building2 size={18} /> Organisations</NavLink>
          )}
        </nav>
        {profile && (
          <div className="sidebar-footer">
            <div className="sidebar-footer-user">
              <User size={16} />
              <span>{profile.full_name}</span>
            </div>
            <button className="btn-signout" onClick={handleSignOut}>
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        )}
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
