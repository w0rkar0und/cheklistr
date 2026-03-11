import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { ClipboardList, CalendarCheck, Users, AlertTriangle, type LucideIcon } from 'lucide-react';

interface DashboardStats {
  totalSubmissions: number;
  submissionsToday: number;
  activeUsers: number;
  totalDefects: number;
}

export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalSubmissions: 0,
    submissionsToday: 0,
    activeUsers: 0,
    totalDefects: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [submissions, todaySubs, users, defects] = await Promise.all([
        supabase.from('submissions').select('id', { count: 'exact', head: true }),
        supabase
          .from('submissions')
          .select('id', { count: 'exact', head: true })
          .gte('ts_form_submitted', today.toISOString()),
        supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true),
        supabase.from('defects').select('id', { count: 'exact', head: true }),
      ]);

      setStats({
        totalSubmissions: submissions.count ?? 0,
        submissionsToday: todaySubs.count ?? 0,
        activeUsers: users.count ?? 0,
        totalDefects: defects.count ?? 0,
      });
      setLoading(false);
    };

    loadStats();
  }, []);

  return (
    <div className="admin-dashboard">
      <h2>Dashboard</h2>

      {loading ? (
        <div className="loading-screen" style={{ minHeight: 'auto', padding: '2rem 0' }}>
          <div className="loading-spinner" />
        </div>
      ) : (
        <>
          <div className="stats-grid">
            <StatCard
              label="Total Inspections"
              value={stats.totalSubmissions}
              colour="primary"
              icon={ClipboardList}
            />
            <StatCard
              label="Today"
              value={stats.submissionsToday}
              colour="accent"
              icon={CalendarCheck}
            />
            <StatCard
              label="Active Users"
              value={stats.activeUsers}
              colour="success"
              icon={Users}
            />
            <StatCard
              label="Total Defects"
              value={stats.totalDefects}
              colour="warning"
              icon={AlertTriangle}
            />
          </div>

          <div className="admin-card" style={{ marginTop: '1.5rem' }}>
            <h3>Getting Started</h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
              Use the sidebar to manage users, view submissions, and configure checklists.
              Start by creating user accounts in the Users section.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  colour,
  icon: Icon,
}: {
  label: string;
  value: number;
  colour: 'primary' | 'accent' | 'success' | 'warning';
  icon: LucideIcon;
}) {
  return (
    <div className={`stat-card stat-card--${colour}`}>
      <div className="stat-card-icon">
        <Icon size={22} />
      </div>
      <div className="stat-card-value">{value}</div>
      <div className="stat-card-label">{label}</div>
    </div>
  );
}
