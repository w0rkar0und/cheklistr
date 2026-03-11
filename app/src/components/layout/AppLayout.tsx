import { Outlet } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

export function AppLayout() {
  const profile = useAuthStore((s) => s.profile);
  const organisation = useAuthStore((s) => s.organisation);

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="header-content">
          {organisation?.logo_url ? (
            <img
              src={organisation.logo_url}
              alt={organisation.name}
              className="header-logo"
            />
          ) : (
            <h1 className="header-title">{organisation?.name ?? 'Cheklistr'}</h1>
          )}
          {profile && (
            <span className="header-user">{profile.full_name}</span>
          )}
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
