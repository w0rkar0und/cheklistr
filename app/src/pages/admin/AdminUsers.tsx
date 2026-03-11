import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { toSyntheticEmail } from '../../lib/auth';
import { useAuthStore } from '../../stores/authStore';
import type { User, UserRole, Organisation } from '../../types/database';

interface NewUserForm {
  loginId: string;
  password: string;
  fullName: string;
  role: UserRole;
  contractorId: string;
  siteCode: string;
  targetOrgId: string;
}

const emptyForm: NewUserForm = {
  loginId: '',
  password: '',
  fullName: '',
  role: 'site_manager',
  contractorId: '',
  siteCode: '',
  targetOrgId: '',
};

export function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewUserForm>({ ...emptyForm });
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Super admin cross-org support
  const [allOrgs, setAllOrgs] = useState<Organisation[]>([]);
  const [filterOrgId, setFilterOrgId] = useState<string>('');

  const profile = useAuthStore((s) => s.profile);
  const organisation = useAuthStore((s) => s.organisation);
  const isSuperAdmin = profile?.role === 'super_admin';

  // Load organisations for super admin
  useEffect(() => {
    if (isSuperAdmin) {
      supabase
        .from('organisations')
        .select('*')
        .eq('is_active', true)
        .order('name')
        .then(({ data }) => {
          if (data) setAllOrgs(data as Organisation[]);
        });
    }
  }, [isSuperAdmin]);

  // Set default org filter and form target once orgs load
  useEffect(() => {
    if (isSuperAdmin && allOrgs.length > 0 && !filterOrgId) {
      // Default to current org
      const currentOrgId = organisation?.id || allOrgs[0].id;
      setFilterOrgId(currentOrgId);
      setForm((prev) => ({ ...prev, targetOrgId: currentOrgId }));
    } else if (!isSuperAdmin && organisation) {
      setFilterOrgId(organisation.id);
      setForm((prev) => ({ ...prev, targetOrgId: organisation.id }));
    }
  }, [isSuperAdmin, allOrgs, organisation, filterOrgId]);

  const loadUsers = async () => {
    setLoading(true);

    let query = supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    // Super admin can filter by org; regular admin sees own org only (RLS enforced)
    if (isSuperAdmin && filterOrgId) {
      query = query.eq('org_id', filterOrgId);
    }

    // Hide super_admin users from regular admin view
    if (!isSuperAdmin) {
      query = query.neq('role', 'super_admin');
    }

    const { data, error } = await query;

    if (!error && data) {
      setUsers(data as User[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (filterOrgId || !isSuperAdmin) {
      loadUsers();
    }
  }, [filterOrgId, isSuperAdmin]);

  const getOrgSlugById = (orgId: string): string => {
    const org = allOrgs.find((o) => o.id === orgId);
    return org?.slug ?? organisation?.slug ?? '';
  };

  const handleCreateUser = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormLoading(true);

    const loginId = form.loginId.trim().toUpperCase();

    if (!loginId) {
      setFormError('User ID is required');
      setFormLoading(false);
      return;
    }

    const targetOrgId = isSuperAdmin ? form.targetOrgId : organisation?.id;
    if (!targetOrgId) {
      setFormError('No organisation selected');
      setFormLoading(false);
      return;
    }

    const targetOrgSlug = isSuperAdmin ? getOrgSlugById(targetOrgId) : (organisation?.slug ?? '');
    if (!targetOrgSlug) {
      setFormError('Could not determine organisation slug');
      setFormLoading(false);
      return;
    }

    try {
      // 0. Capture admin identity and session BEFORE signUp() switches it
      const adminId = useAuthStore.getState().profile?.id;
      if (!adminId) throw new Error('Admin session not found');

      // Read session from localStorage
      const url = import.meta.env.VITE_SUPABASE_URL as string;
      const projectRef = new URL(url).hostname.split('.')[0];
      const storageKey = `sb-${projectRef}-auth-token`;
      const rawSession = localStorage.getItem(storageKey);
      if (!rawSession) throw new Error('Admin auth session not found in localStorage');
      const adminSession = JSON.parse(rawSession);
      if (!adminSession?.access_token || !adminSession?.refresh_token) {
        throw new Error('Admin auth session is incomplete');
      }

      // 1. Suppress auth state listener
      useAuthStore.getState().setSuppressAuthEvents(true);

      // 2. Create Supabase auth user with synthetic email
      const syntheticEmail = toSyntheticEmail(loginId, targetOrgSlug);

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: syntheticEmail,
        password: form.password,
      });

      if (authError || !authData.user) {
        throw new Error(authError?.message ?? 'Failed to create auth user');
      }

      // 3. Immediately restore the admin session
      await supabase.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token,
      });

      // 4. Delay before re-enabling auth listener
      await new Promise((resolve) => setTimeout(resolve, 500));
      useAuthStore.getState().setSuppressAuthEvents(false);

      // 5. Insert into users table via SECURITY DEFINER function
      const { error: rpcError } = await supabase.rpc('admin_create_user', {
        p_user_id: authData.user.id,
        p_login_id: loginId,
        p_full_name: form.fullName,
        p_email: syntheticEmail,
        p_role: form.role,
        p_org_id: targetOrgId,
        p_contractor_id: form.contractorId || null,
        p_site_code: form.siteCode || null,
        p_admin_id: adminId,
      });

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      // Reset and reload
      setForm({ ...emptyForm, targetOrgId: filterOrgId });
      setShowForm(false);
      await loadUsers();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      useAuthStore.getState().setSuppressAuthEvents(false);
      setFormLoading(false);
    }
  };

  const handleToggleActive = async (user: User) => {
    const { error } = await supabase
      .from('users')
      .update({ is_active: !user.is_active })
      .eq('id', user.id);

    if (!error) {
      await loadUsers();
    }
  };

  return (
    <div className="admin-users">
      <div className="admin-page-header">
        <h2>User Management</h2>
        <button
          className="btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancel' : '+ New User'}
        </button>
      </div>

      {/* Super admin org filter */}
      {isSuperAdmin && allOrgs.length > 0 && (
        <div className="admin-card" style={{ marginBottom: '1rem', padding: '0.75rem 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <label htmlFor="filter-org" style={{ fontWeight: 500, margin: 0, whiteSpace: 'nowrap' }}>
              Organisation:
            </label>
            <select
              id="filter-org"
              value={filterOrgId}
              onChange={(e) => setFilterOrgId(e.target.value)}
              style={{ flex: 1 }}
            >
              {allOrgs.map((org) => (
                <option key={org.id} value={org.id}>{org.name} ({org.slug})</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Create User Form */}
      {showForm && (
        <div className="admin-card" style={{ marginBottom: '1.5rem' }}>
          <h3>Create New User</h3>
          <form onSubmit={handleCreateUser}>
            {formError && <div className="error-message">{formError}</div>}

            {/* Super admin: org selector for target org */}
            {isSuperAdmin && allOrgs.length > 0 && (
              <>
                <label htmlFor="target-org">Target Organisation *</label>
                <select
                  id="target-org"
                  value={form.targetOrgId}
                  onChange={(e) => setForm({ ...form, targetOrgId: e.target.value })}
                  required
                >
                  {allOrgs.map((org) => (
                    <option key={org.id} value={org.id}>{org.name} ({org.slug})</option>
                  ))}
                </select>
              </>
            )}

            <label htmlFor="new-login-id">User ID *</label>
            <input
              id="new-login-id"
              type="text"
              value={form.loginId}
              onChange={(e) => setForm({ ...form, loginId: e.target.value.toUpperCase() })}
              placeholder="e.g. X123456 or ADMIN01"
              required
              autoCapitalize="characters"
            />

            <label htmlFor="new-password">Password *</label>
            <input
              id="new-password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
            />

            <label htmlFor="new-name">Full Name *</label>
            <input
              id="new-name"
              type="text"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              required
            />

            <label htmlFor="new-role">Role *</label>
            <select
              id="new-role"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
            >
              <option value="site_manager">Site Manager</option>
              <option value="admin">Admin</option>
              {isSuperAdmin && <option value="super_admin">Super Admin</option>}
            </select>

            <label htmlFor="new-contractor">Contractor ID (HR Code)</label>
            <input
              id="new-contractor"
              type="text"
              value={form.contractorId}
              onChange={(e) => setForm({ ...form, contractorId: e.target.value })}
              placeholder="e.g. X123456"
            />

            <label htmlFor="new-site">Site Code</label>
            <input
              id="new-site"
              type="text"
              value={form.siteCode}
              onChange={(e) => setForm({ ...form, siteCode: e.target.value })}
              placeholder="e.g. BHX1"
            />

            <button
              type="submit"
              className="btn-primary"
              disabled={formLoading}
              style={{ width: '100%', marginTop: '0.5rem' }}
            >
              {formLoading ? 'Creating...' : 'Create User'}
            </button>
          </form>
        </div>
      )}

      {/* Users List */}
      {loading ? (
        <div className="loading-screen" style={{ minHeight: 'auto', padding: '2rem 0' }}>
          <div className="loading-spinner" />
        </div>
      ) : users.length === 0 ? (
        <p className="empty-state">No users found</p>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User ID</th>
                <th>Name</th>
                <th>Role</th>
                <th>Contractor ID</th>
                <th>Site</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className={!user.is_active ? 'row-inactive' : ''}>
                  <td className="td-mono">{user.login_id}</td>
                  <td>{user.full_name}</td>
                  <td>
                    <span className={`role-badge role-badge--${user.role}`}>
                      {user.role === 'super_admin' ? 'Super Admin' : user.role === 'admin' ? 'Admin' : 'Site Manager'}
                    </span>
                  </td>
                  <td>{user.contractor_id ?? '—'}</td>
                  <td>{user.site_code ?? '—'}</td>
                  <td>
                    <span className={`status-badge status-badge--${user.is_active ? 'active' : 'inactive'}`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn-secondary btn-sm"
                      onClick={() => handleToggleActive(user)}
                    >
                      {user.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
