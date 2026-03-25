import { useState, useEffect } from 'react';
import { checkReportStatus } from '../api';
import { saveCase, getCases } from '../utils/victimStorage';
import './TrackCase.css';

function getPillClass(status) {
  if (!status) return 'open';
  const s = status.toLowerCase();
  if (s.includes('close') || s.includes('resolv')) return 'closed';
  if (s.includes('pend') || s.includes('review')) return 'pending';
  return 'open';
}

function EmptyState() {
  return (
    <div className="tc-empty">
      <div className="tc-empty-icon">
        <svg viewBox="0 0 18 18" fill="none" stroke="#4e5466" strokeWidth="1.4" strokeLinecap="round">
          <circle cx="9" cy="9" r="7" />
          <path d="M9 6v4M9 11.5v.5" />
        </svg>
      </div>
      <p className="tc-empty-text">
        Enter your report ID and<br />token to view case status
      </p>
    </div>
  );
}

function CaseResult({ reportId, data }) {
  return (
    <div className="tc-result">
      <div className="tc-pane-label">Case status</div>
      <div className="tc-status-header">
        <div className="tc-status-id">{reportId}</div>
        <span className={`tc-status-pill ${getPillClass(data.status)}`}>
          {data.status}
        </span>
      </div>

      <div className="tc-pane-label" style={{ marginBottom: 12 }}>Timeline</div>
      <div className="tc-timeline">
        {data.timeline.map((t, i) => (
          <div key={i} className="tc-tl-row">
            <div className="tc-tl-track">
              <div className="tc-tl-dot" />
              <div className="tc-tl-line" />
            </div>
            <div className="tc-tl-body">
              <div className="tc-tl-action">{t.action}</div>
              <div className="tc-tl-meta">
                {t.status && <span className="tc-tl-badge">{t.status}</span>}
                <span className="tc-tl-time">
                  {new Date(t.timestamp).toLocaleDateString(undefined, {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TrackCase() {
  const [reportId, setReportId] = useState('');
  const [token, setToken] = useState('');
  const [remember, setRemember] = useState(false);
  const [data, setData] = useState(null);
  const [savedCases, setSavedCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setSavedCases(getCases());
  }, []);

  async function handleTrack() {
    if (!reportId.trim() || !token.trim()) {
      setError('Please enter both a report ID and token.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await checkReportStatus(reportId, token);
      setData(res);
      if (remember) {
        saveCase(reportId, token);
        setSavedCases(getCases());
      }
    } catch {
      setError('Invalid report ID or token. Please try again.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadSaved(c) {
    setReportId(c.reportId);
    setToken(c.token);
    setError('');
    setLoading(true);
    try {
      const res = await checkReportStatus(c.reportId, c.token);
      setData(res);
    } catch {
      setError('Could not load saved case.');
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter') handleTrack();
  }

  return (
    <div className="tc-root">
      <div className="tc-shell">

        {/* Top bar */}
        <div className="tc-topbar">
          <div className="tc-topbar-left">
            <div className="tc-topbar-icon">
              <svg viewBox="0 0 14 14" fill="none" stroke="#4f7cff" strokeWidth="1.4" strokeLinecap="round">
                <rect x="1.5" y="1.5" width="11" height="11" rx="2" />
                <path d="M4 7h6M4 4.5h3M4 9.5h4" />
              </svg>
            </div>
            <div>
              <div className="tc-topbar-title">Case tracker</div>
              <div className="tc-topbar-sub">Secure status portal</div>
            </div>
          </div>
        </div>

        {/* Split body */}
        <div className="tc-body">

          {/* Left — form */}
          <div className="tc-pane tc-pane-left">
            <div className="tc-pane-label">Lookup</div>

            <div className="tc-field">
              <label htmlFor="tc-report-id">Report ID</label>
              <input
                id="tc-report-id"
                className="tc-input"
                placeholder="RPT-2024-00142"
                value={reportId}
                onChange={e => setReportId(e.target.value)}
                onKeyDown={handleKey}
              />
            </div>

            <div className="tc-field" style={{ marginBottom: 14 }}>
              <label htmlFor="tc-token">Access token</label>
              <input
                id="tc-token"
                className="tc-input"
                type="password"
                placeholder="Enter your token"
                value={token}
                onChange={e => setToken(e.target.value)}
                onKeyDown={handleKey}
              />
            </div>

            <label className="tc-remember">
              <input
                type="checkbox"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
              />
              <span className="tc-remember-text">Remember on this device</span>
              <span className="tc-warn-tag">local</span>
            </label>

            <button className="tc-btn" onClick={handleTrack} disabled={loading}>
              {loading ? (
                <><span className="tc-spinner" />Checking…</>
              ) : (
                <>
                  <svg viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <circle cx="5.5" cy="5.5" r="4" /><path d="M9 9l2.5 2.5" />
                  </svg>
                  Track case
                </>
              )}
            </button>

            {error && (
              <div className="tc-error">
                <svg viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                  <circle cx="6.5" cy="6.5" r="5.5" /><path d="M6.5 4v3.5M6.5 9v.5" />
                </svg>
                {error}
              </div>
            )}

            {savedCases.length > 0 && (
              <div className="tc-saved-section">
                <div className="tc-saved-label">Recents</div>
                <div className="tc-chip-row">
                  {savedCases.map(c => (
                    <button key={c.reportId} className="tc-chip" onClick={() => loadSaved(c)}>
                      {c.reportId}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right — result */}
          <div className="tc-pane tc-pane-right">
            {data
              ? <CaseResult reportId={reportId} data={data} />
              : <EmptyState />
            }
          </div>

        </div>
      </div>
    </div>
  );
}
