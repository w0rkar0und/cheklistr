import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPendingSubmissions, deletePendingSubmission } from '../../lib/offlineDb';
import { syncSubmission } from '../../lib/syncSubmission';
import { getAccessTokenFromStorage } from '../../lib/supabase';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import type { PendingSubmission } from '../../lib/offlineDb';
import type { SyncProgress } from '../../lib/syncSubmission';

export function PendingSubmissionsPage() {
  const navigate = useNavigate();
  const { isOnline } = useOnlineStatus();
  const [submissions, setSubmissions] = useState<PendingSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [syncCurrent, setSyncCurrent] = useState(0);
  const [syncTotal, setSyncTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const pending = await getPendingSubmissions();
      setSubmissions(pending);
    } catch (err) {
      console.error('[PENDING] Failed to load:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  const handleSyncAll = async () => {
    if (!isOnline) {
      setError('You are currently offline. Please connect to the internet to sync.');
      return;
    }

    const accessToken = getAccessTokenFromStorage();
    if (!accessToken) {
      setError('No auth token found. Please log out and log back in.');
      return;
    }

    setSyncing(true);
    setError(null);
    setSyncTotal(submissions.length);

    let successCount = 0;

    for (let i = 0; i < submissions.length; i++) {
      setSyncCurrent(i + 1);
      setSyncStatus(`Syncing ${i + 1} of ${submissions.length}…`);

      const result = await syncSubmission(
        submissions[i],
        accessToken,
        (progress) => setSyncProgress(progress),
      );

      if (result.success) {
        successCount++;
      } else {
        console.error(`[PENDING] Submission ${i + 1} failed:`, result.error);
      }
    }

    setSyncing(false);
    setSyncProgress(null);
    setSyncStatus('');

    if (successCount === submissions.length) {
      setSyncStatus(`All ${successCount} submission(s) synced successfully!`);
    } else {
      setError(`${successCount}/${submissions.length} synced. Some submissions failed — please try again.`);
    }

    await loadSubmissions();
  };

  const handleSyncOne = async (submission: PendingSubmission) => {
    if (!isOnline) {
      setError('You are currently offline.');
      return;
    }

    const accessToken = getAccessTokenFromStorage();
    if (!accessToken) {
      setError('No auth token found. Please log out and log back in.');
      return;
    }

    setSyncing(true);
    setError(null);
    setSyncTotal(1);
    setSyncCurrent(1);
    setSyncStatus('Syncing…');

    const result = await syncSubmission(
      submission,
      accessToken,
      (progress) => setSyncProgress(progress),
    );

    setSyncing(false);
    setSyncProgress(null);

    if (result.success) {
      setSyncStatus('Synced successfully!');
    } else {
      setError(`Sync failed: ${result.error}`);
    }

    await loadSubmissions();
  };

  const handleDelete = async (submission: PendingSubmission) => {
    if (!confirm(`Delete submission for ${submission.vehicleRegistration}? This cannot be undone.`)) {
      return;
    }

    if (submission.id != null) {
      await deletePendingSubmission(submission.id);
      await loadSubmissions();
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="pending-page">
      <div className="pending-header">
        <button className="btn-back" onClick={() => navigate('/')}>
          ← Back
        </button>
        <h2>Pending Submissions</h2>
      </div>

      {error && <div className="error-message">{error}</div>}

      {syncStatus && !error && (
        <div className="success-message">{syncStatus}</div>
      )}

      {syncing && (
        <div className="sync-progress-bar">
          <div className="sync-progress-info">
            <span>{syncStatus}</span>
            {syncProgress && (
              <span className="sync-step">Step {syncProgress.step}: {syncProgress.detail}</span>
            )}
          </div>
          <div className="sync-progress-track">
            <div
              className="sync-progress-fill"
              style={{ width: `${(syncCurrent / syncTotal) * 100}%` }}
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-screen" style={{ minHeight: 'auto', padding: '2rem 0' }}>
          <div className="loading-spinner" />
          <p>Loading…</p>
        </div>
      ) : submissions.length === 0 ? (
        <div className="empty-state-card">
          <p>No pending submissions</p>
          <p className="empty-state-sub">All submissions have been synced.</p>
        </div>
      ) : (
        <>
          <button
            className="btn-primary btn-large"
            onClick={handleSyncAll}
            disabled={syncing || !isOnline}
            style={{ width: '100%', marginBottom: '1rem' }}
          >
            {syncing
              ? `Syncing ${syncCurrent}/${syncTotal}…`
              : isOnline
              ? `Sync All (${submissions.length})`
              : 'Offline — cannot sync'}
          </button>

          <div className="pending-list">
            {submissions.map((sub) => (
              <div key={sub.id ?? sub.submissionId} className="pending-card">
                <div className="pending-card-top">
                  <span className="submission-vrm">{sub.vehicleRegistration}</span>
                  <span className="pending-badge">Pending</span>
                </div>
                <div className="pending-card-details">
                  {sub.contractorName && <span>{sub.contractorName}</span>}
                  {sub.contractorId && (
                    <span className="td-secondary"> ({sub.contractorId})</span>
                  )}
                </div>
                <div className="pending-card-meta">
                  <span>{formatDate(sub.createdAt)}</span>
                  <span>{sub.photos.length} photos</span>
                  {sub.defects.length > 0 && (
                    <span>{sub.defects.length} defect(s)</span>
                  )}
                </div>
                <div className="pending-card-actions">
                  <button
                    className="btn-primary btn-small"
                    onClick={() => handleSyncOne(sub)}
                    disabled={syncing || !isOnline}
                  >
                    Sync
                  </button>
                  <button
                    className="btn-danger btn-small"
                    onClick={() => handleDelete(sub)}
                    disabled={syncing}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
