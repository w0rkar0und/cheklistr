import { Outlet, NavLink } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

export function AdminLayout() {
  const profile = useAuthStore((s) => s.profile);

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="sidebar-header">
          <h2>Cheklistr</h2>
          <span className="sidebar-badge">Admin</span>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/admin" end>Dashboard</NavLink>
          <NavLink to="/admin/submissions">Submissions</NavLink>
          <NavLink to="/admin/checklists">Checklists</NavLink>
          <NavLink to="/admin/users">Users</NavLink>
          <NavLink to="/admin/sessions">Sessions</NavLink>
        </nav>
        {profile && (
          <div className="sidebar-footer">
            <span>{profile.full_name}</span>
          </div>
        )}
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
