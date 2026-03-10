import { Outlet, NavLink } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

export function AdminLayout() {
  const profile = useAuthStore((s) => s.profile);
  const organisation = useAuthStore((s) => s.organisation);

  // Apply org branding via CSS custom property
  const brandStyle = organisation?.primary_colour
    ? { '--org-primary': organisation.primary_colour } as React.CSSProperties
    : undefined;

  return (
    <div className="admin-layout" style={brandStyle}>
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
