import { Outlet } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

export function AppLayout() {
  const profile = useAuthStore((s) => s.profile);

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="header-content">
          <h1 className="header-title">Cheklistr</h1>
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
