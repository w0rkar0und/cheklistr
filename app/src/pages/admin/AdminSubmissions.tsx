import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import type { Submission } from '../../types/database';

export function AdminSubmissions() {
  const navigate = useNavigate();
  const profile = useAuthStore((s) => s.profile);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const loadSubmissions = async () => {
    setLoading(true);
    let query = supabase
      .from('submissions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (showArchived) {
      query = query.not('archived_at', 'is', null);
    } else {
      query = query.is('archived_at', null);
    }

    const { data, error } = await query;

    if (!error && data) {
      setSubmissions(data as Submission[]);
    }
    setSelected(new Set());
    setLoading(false);
  };

  useEffect(() => {
    loadSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchived]);

  const filteredSubmissions = filter
    ? submissions.filter(
        (s) =>
          s.vehicle_registration.toLowerCase().includes(filter.toLowerCase()) ||
          s.contractor_name?.toLowerCase().includes(filter.toLowerCase()) ||
          s.contractor_id?.toLowerCase().includes(filter.toLowerCase()) ||
          s.site_code?.toLowerCase().includes(filter.toLowerCase())
      )
    : submissions;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filteredSubmissions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredSubmissions.map((s) => s.id)));
    }
  };

  const handleBulkAction = async () => {
    if (selected.size === 0 || !profile) return;
    const action = showArchived ? 'restore' : 'archive';
    const count = selected.size;
    if (!window.confirm(`${action === 'archive' ? 'Archive' : 'Restore'} ${count} submission${count > 1 ? 's' : ''}?`)) return;

    setBulkProcessing(true);
    try {
      const updateData = showArchived
        ? { archived_at: null, archived_by: null }
        : { archived_at: new Date().toISOString(), archived_by: profile.id };

      const { error } = await supabase
        .from('submissions')
        .update(updateData)
        .in('id', Array.from(selected));

      if (error) {
        alert(`Failed to ${action} submissions.`);
        console.error(error);
      } else {
        // Remove actioned items from the list
        setSubmissions((prev) => prev.filter((s) => !selected.has(s.id)));
        setSelected(new Set());
      }
    } finally {
      setBulkProcessing(false);
    }
  };

  const formatDate = (d: string | null) =>
    d
      ? new Date(d).toLocaleString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—';

  return (
    <div className="admin-submissions">
      <div className="admin-page-header">
        <h2>Submissions</h2>
        <span className="admin-count">{filteredSubmissions.length} records</span>
      </div>

      <div className="admin-toolbar">
        <input
          type="text"
          placeholder="Filter by VRM, contractor, or site..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="admin-filter-input"
        />
        <button
          className={`btn-toggle ${showArchived ? 'btn-toggle--active' : ''}`}
          onClick={() => setShowArchived(!showArchived)}
        >
          {showArchived ? 'Showing Archived' : 'Show Archived'}
        </button>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="bulk-action-bar">
          <span>{selected.size} selected</span>
          <button
            className={showArchived ? 'btn-primary btn-small' : 'btn-danger btn-small'}
            onClick={handleBulkAction}
            disabled={bulkProcessing}
          >
            {bulkProcessing
              ? (showArchived ? 'Restoring…' : 'Archiving…')
              : (showArchived ? `Restore (${selected.size})` : `Archive (${selected.size})`)}
          </button>
          <button
            className="btn-secondary btn-small"
            onClick={() => setSelected(new Set())}
          >
            Clear
          </button>
        </div>
      )}

      {loading ? (
        <div className="loading-screen" style={{ minHeight: 'auto', padding: '2rem 0' }}>
          <div className="loading-spinner" />
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <p className="empty-state">
          {showArchived ? 'No archived submissions' : 'No submissions found'}
        </p>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="th-checkbox">
                  <input
                    type="checkbox"
                    checked={selected.size === filteredSubmissions.length && filteredSubmissions.length > 0}
                    onChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </th>
                <th>VRM</th>
                <th>Contractor</th>
                <th>Site</th>
                <th>Status</th>
                <th>Defects</th>
                <th>{showArchived ? 'Archived' : 'Submitted'}</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubmissions.map((sub) => (
                <tr
                  key={sub.id}
                  className={`clickable-row ${selected.has(sub.id) ? 'row-selected' : ''}`}
                >
                  <td className="td-checkbox" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(sub.id)}
                      onChange={() => toggleSelect(sub.id)}
                      aria-label={`Select ${sub.vehicle_registration}`}
                    />
                  </td>
                  <td
                    className="td-mono"
                    onClick={() => navigate(`/admin/submissions/${sub.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    {sub.vehicle_registration}
                  </td>
                  <td
                    onClick={() => navigate(`/admin/submissions/${sub.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    {sub.contractor_name}
                    {sub.contractor_id && (
                      <span className="td-secondary"> ({sub.contractor_id})</span>
                    )}
                  </td>
                  <td
                    onClick={() => navigate(`/admin/submissions/${sub.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    {sub.site_code ?? '—'}
                  </td>
                  <td
                    onClick={() => navigate(`/admin/submissions/${sub.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className={`status-badge status-badge--${sub.status}`}>
                      {sub.status}
                    </span>
                  </td>
                  <td
                    onClick={() => navigate(`/admin/submissions/${sub.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    {sub.defect_summary ?? 'None'}
                  </td>
                  <td
                    onClick={() => navigate(`/admin/submissions/${sub.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    {showArchived
                      ? formatDate(sub.archived_at)
                      : formatDate(sub.ts_form_submitted)}
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
