import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import type { Organisation } from '../../types/database';

// ============================================================
// AdminOrganisations — Super Admin organisation management
// ============================================================
// Lists all organisations with user counts.
// Create new orgs and edit existing ones.
// Only accessible to super_admin users.
// ============================================================

interface OrgWithCount extends Organisation {
  user_count: number;
}

interface OrgForm {
  name: string;
  slug: string;
  primary_colour: string;
}

const emptyForm: OrgForm = {
  name: '',
  slug: '',
  primary_colour: '#2E4057',
};

export function AdminOrganisations() {
  const [orgs, setOrgs] = useState<OrgWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organisation | null>(null);
  const [form, setForm] = useState<OrgForm>({ ...emptyForm });
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const loadOrganisations = async () => {
    setLoading(true);

    // Fetch all organisations
    const { data: orgData, error: orgError } = await supabase
      .from('organisations')
      .select('*')
      .order('created_at', { ascending: true });

    if (orgError || !orgData) {
      console.error('Failed to load organisations:', orgError);
      setLoading(false);
      return;
    }

    // Fetch user counts per org
    const { data: countData, error: countError } = await supabase
      .from('users')
      .select('org_id');

    if (countError) {
      console.error('Failed to load user counts:', countError);
    }

    // Tally counts
    const counts: Record<string, number> = {};
    if (countData) {
      for (const row of countData) {
        counts[row.org_id] = (counts[row.org_id] || 0) + 1;
      }
    }

    const orgsWithCounts: OrgWithCount[] = (orgData as Organisation[]).map((org) => ({
      ...org,
      user_count: counts[org.id] || 0,
    }));

    setOrgs(orgsWithCounts);
    setLoading(false);
  };

  useEffect(() => {
    loadOrganisations();
  }, []);

  // ---- Create Organisation ----

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormLoading(true);

    const slug = form.slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '');
    const name = form.name.trim();

    if (!name) {
      setFormError('Organisation name is required');
      setFormLoading(false);
      return;
    }

    if (!slug || slug.length < 2) {
      setFormError('Slug must be at least 2 characters (lowercase letters, numbers, hyphens)');
      setFormLoading(false);
      return;
    }

    try {
      const { error } = await supabase.from('organisations').insert({
        name,
        slug,
        primary_colour: form.primary_colour || '#2E4057',
      });

      if (error) {
        if (error.code === '23505') {
          setFormError('An organisation with this slug already exists');
        } else {
          throw error;
        }
        setFormLoading(false);
        return;
      }

      setForm({ ...emptyForm });
      setShowCreateForm(false);
      await loadOrganisations();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create organisation');
    } finally {
      setFormLoading(false);
    }
  };

  // ---- Edit Organisation ----

  const startEdit = (org: Organisation) => {
    setEditingOrg(org);
    setForm({
      name: org.name,
      slug: org.slug,
      primary_colour: org.primary_colour,
    });
    setFormError(null);
    setShowCreateForm(false);
  };

  const cancelEdit = () => {
    setEditingOrg(null);
    setForm({ ...emptyForm });
    setFormError(null);
  };

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingOrg) return;
    setFormError(null);
    setFormLoading(true);

    const name = form.name.trim();
    if (!name) {
      setFormError('Organisation name is required');
      setFormLoading(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('organisations')
        .update({
          name,
          primary_colour: form.primary_colour || '#2E4057',
        })
        .eq('id', editingOrg.id);

      if (error) throw error;

      setEditingOrg(null);
      setForm({ ...emptyForm });
      await loadOrganisations();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to update organisation');
    } finally {
      setFormLoading(false);
    }
  };

  // ---- Toggle Active ----

  const handleToggleActive = async (org: Organisation) => {
    const { error } = await supabase
      .from('organisations')
      .update({ is_active: !org.is_active })
      .eq('id', org.id);

    if (!error) {
      await loadOrganisations();
    }
  };

  return (
    <div className="admin-organisations">
      <div className="admin-page-header">
        <h2>Organisations</h2>
        {!editingOrg && (
          <button
            className="btn-primary"
            onClick={() => {
              setShowCreateForm(!showCreateForm);
              setForm({ ...emptyForm });
              setFormError(null);
            }}
          >
            {showCreateForm ? 'Cancel' : '+ New Organisation'}
          </button>
        )}
      </div>

      {/* Create Form */}
      {showCreateForm && !editingOrg && (
        <div className="admin-card" style={{ marginBottom: '1.5rem' }}>
          <h3>Create New Organisation</h3>
          <form onSubmit={handleCreate} noValidate>
            {formError && <div className="error-message">{formError}</div>}

            <label htmlFor="org-name">Organisation Name *</label>
            <input
              id="org-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Acme Logistics"
              required
            />

            <label htmlFor="org-slug">Slug *</label>
            <input
              id="org-slug"
              type="text"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
              placeholder="e.g. acme"
              required
              autoCapitalize="none"
            />
            <small style={{ color: '#666', display: 'block', marginTop: '-0.5rem', marginBottom: '0.75rem' }}>
              Used for login — lowercase letters, numbers, and hyphens only
            </small>

            <label htmlFor="org-colour">Brand Colour</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input
                id="org-colour"
                type="color"
                value={form.primary_colour}
                onChange={(e) => setForm({ ...form, primary_colour: e.target.value })}
                style={{ width: '3rem', height: '2.5rem', padding: '0.25rem', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}
              />
              <input
                type="text"
                value={form.primary_colour}
                onChange={(e) => setForm({ ...form, primary_colour: e.target.value })}
                placeholder="#2E4057"
                style={{ flex: 1 }}
              />
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={formLoading}
              style={{ width: '100%', marginTop: '1rem' }}
            >
              {formLoading ? 'Creating...' : 'Create Organisation'}
            </button>
          </form>
        </div>
      )}

      {/* Edit Form */}
      {editingOrg && (
        <div className="admin-card" style={{ marginBottom: '1.5rem' }}>
          <h3>Edit Organisation: {editingOrg.name}</h3>
          <form onSubmit={handleUpdate} noValidate>
            {formError && <div className="error-message">{formError}</div>}

            <label htmlFor="edit-org-name">Organisation Name *</label>
            <input
              id="edit-org-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />

            <label>Slug</label>
            <input
              type="text"
              value={editingOrg.slug}
              disabled
              style={{ opacity: 0.6 }}
            />
            <small style={{ color: '#666', display: 'block', marginTop: '-0.5rem', marginBottom: '0.75rem' }}>
              Slug cannot be changed after creation (would break existing user logins)
            </small>

            <label htmlFor="edit-org-colour">Brand Colour</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input
                id="edit-org-colour"
                type="color"
                value={form.primary_colour}
                onChange={(e) => setForm({ ...form, primary_colour: e.target.value })}
                style={{ width: '3rem', height: '2.5rem', padding: '0.25rem', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}
              />
              <input
                type="text"
                value={form.primary_colour}
                onChange={(e) => setForm({ ...form, primary_colour: e.target.value })}
                style={{ flex: 1 }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                type="submit"
                className="btn-primary"
                disabled={formLoading}
                style={{ flex: 1 }}
              >
                {formLoading ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={cancelEdit}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Organisations List */}
      {loading ? (
        <div className="loading-screen" style={{ minHeight: 'auto', padding: '2rem 0' }}>
          <div className="loading-spinner" />
        </div>
      ) : orgs.length === 0 ? (
        <p className="empty-state">No organisations found</p>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Users</th>
                <th>Colour</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((org) => (
                <tr key={org.id} className={!org.is_active ? 'row-inactive' : ''}>
                  <td style={{ fontWeight: 500 }}>{org.name}</td>
                  <td className="td-mono">{org.slug}</td>
                  <td>{org.user_count}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          width: '1rem',
                          height: '1rem',
                          borderRadius: '3px',
                          backgroundColor: org.primary_colour,
                          border: '1px solid rgba(0,0,0,0.15)',
                        }}
                      />
                      <span className="td-mono" style={{ fontSize: '0.8rem' }}>{org.primary_colour}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge status-badge--${org.is_active ? 'active' : 'inactive'}`}>
                      {org.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn-secondary btn-sm"
                        onClick={() => startEdit(org)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn-secondary btn-sm"
                        onClick={() => handleToggleActive(org)}
                      >
                        {org.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
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
