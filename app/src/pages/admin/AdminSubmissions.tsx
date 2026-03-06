import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Submission } from '../../types/database';

export function AdminSubmissions() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const loadSubmissions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && data) {
      setSubmissions(data as Submission[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSubmissions();
  }, []);

  const filteredSubmissions = filter
    ? submissions.filter(
        (s) =>
          s.vehicle_registration.toLowerCase().includes(filter.toLowerCase()) ||
          s.contractor_name?.toLowerCase().includes(filter.toLowerCase()) ||
          s.contractor_id?.toLowerCase().includes(filter.toLowerCase()) ||
          s.site_code?.toLowerCase().includes(filter.toLowerCase())
      )
    : submissions;

  return (
    <div className="admin-submissions">
      <div className="admin-page-header">
        <h2>Submissions</h2>
        <span className="admin-count">{filteredSubmissions.length} records</span>
      </div>

      <input
        type="text"
        placeholder="Filter by VRM, contractor, or site..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="admin-filter-input"
      />

      {loading ? (
        <div className="loading-screen" style={{ minHeight: 'auto', padding: '2rem 0' }}>
          <div className="loading-spinner" />
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <p className="empty-state">No submissions found</p>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>VRM</th>
                <th>Contractor</th>
                <th>Site</th>
                <th>Status</th>
                <th>Defects</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubmissions.map((sub) => (
                <tr key={sub.id}>
                  <td className="td-mono">{sub.vehicle_registration}</td>
                  <td>
                    {sub.contractor_name}
                    {sub.contractor_id && (
                      <span className="td-secondary"> ({sub.contractor_id})</span>
                    )}
                  </td>
                  <td>{sub.site_code ?? '—'}</td>
                  <td>
                    <span className={`status-badge status-badge--${sub.status}`}>
                      {sub.status}
                    </span>
                  </td>
                  <td>{sub.defect_summary ?? 'None'}</td>
                  <td>
                    {sub.ts_form_submitted
                      ? new Date(sub.ts_form_submitted).toLocaleString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
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
