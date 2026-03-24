import { useState } from 'react';
import { checkReportStatus } from '../api';
import { Button, Input, Alert, Card, StatusBadge } from '../components/UI';
import styles from './Pages.module.css';

function fmt(d) {
  return new Date(d).toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

export default function TrackCase() {
  const [reportId, setReportId]   = useState('');
  const [token, setToken]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState(null);

  async function handleTrack() {
    if (!reportId || !token) { setError('Both fields are required.'); return; }
    setError(null); setLoading(true);
    try {
      const data = await checkReportStatus(reportId, token);
      setResult(data);
    } catch (e) {
      setError('Could not verify. Check your report ID and token.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fade-up">
      <Alert type="info">
        Enter the report ID and private token you received when you submitted your report.
        Nothing identifying you is stored — your token is the only key.
      </Alert>

      <Card title="Check Case Status">
        <Input
          label="Report ID"
          id="reportId"
          placeholder="e.g. A1B2C3D4"
          value={reportId}
          onChange={e => setReportId(e.target.value)}
        />
        <Input
          label="Your Private Token"
          id="token"
          type="password"
          placeholder="Paste your private token here..."
          value={token}
          onChange={e => setToken(e.target.value)}
        />
        {error && <Alert type="danger">{error}</Alert>}
        <Button onClick={handleTrack} disabled={loading}>
          {loading ? 'Verifying…' : 'Check Status'}
        </Button>
      </Card>

      {result && (
        <Card title="Case Status">
          <div className={styles.statusRow}>
            <span className={styles.mono}>{result.reportId}</span>
            <StatusBadge status={result.status} />
          </div>
          <p className={styles.statusMsg}>{result.message}</p>
          <div className={styles.infoGrid}>
            <div><div className={styles.infoKey}>Category</div><div className={styles.infoVal}>{result.category?.replace(/_/g,' ')}</div></div>
            <div><div className={styles.infoKey}>Assigned</div><div className={styles.infoVal}>{result.assignedTo || 'Pending assignment'}</div></div>
            <div><div className={styles.infoKey}>Submitted</div><div className={styles.infoVal}>{fmt(result.createdAt)}</div></div>
            <div><div className={styles.infoKey}>Last Update</div><div className={styles.infoVal}>{fmt(result.lastUpdated)}</div></div>
          </div>
        </Card>
      )}
    </div>
  );
}
