import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { getAllReports, updateReportStatus, getAuditLog, getEvidenceByReport, retrieveFileFromIPFS } from '../api';
import { Alert, StatusBadge, Button, Select, Textarea, Modal, Spinner, Empty } from '../components/UI';
import styles from './AllReports.module.css';

const STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'EVIDENCE_REQUESTED', 'REFERRED', 'CLOSED_RESOLVED', 'CLOSED_WITHDRAWN'];

const DEMO = [
  { reportId: 'ABDD1B3D67E2054D', category: 'online_harassment', status: 'SUBMITTED', description: 'Received threatening messages online repeatedly over the past week.', evidenceHash: '1212121212', assignedTo: null, createdAt: '2026-03-15T08:37:08.000Z', lastUpdated: '2026-03-15T08:37:08.000Z', accessLog: [] },
  { reportId: 'C5454724CFAA8183', category: 'online_harassment', status: 'REFERRED', description: 'Unwanted contact and harassment via social media platforms.', evidenceHash: 'gigig', assignedTo: null, createdAt: '2026-03-15T08:41:59.000Z', lastUpdated: '2026-03-15T08:41:59.000Z', accessLog: [] },
];

function fmt(d) { return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function fmtShort(d) { return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
function categoryLabel(c) {
  const map = { online_harassment: 'Online Harassment', image_abuse: 'Image Abuse', stalking: 'Stalking', threats: 'Threats', doxxing: 'Doxxing', other: 'Other' };
  return map[c] || c?.replace(/_/g, ' ');
}

// Whether the current org can view evidence for a given report
function canViewEvidence(org, reportStatus) {
  if (org === 'Org2MSP') return true;
  if (org === 'Org3MSP') return reportStatus === 'REFERRED';
  return false;
}

// Derive content type from filename or default to image
function guessType(filename = '') {
  if (filename.match(/\.pdf$/i)) return 'pdf';
  if (filename.match(/\.(mp4|webm|mov)$/i)) return 'video';
  return 'image';
}

// ─── Evidence section ───────────────────────────────────────────────────────
function EvidenceSection({ reportId, reportStatus, org }) {
  const [items, setItems] = useState(null);   // null = not fetched yet
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lightbox, setLightbox] = useState(null); // cid to show full-screen
  const [fileUrls, setFileUrls] = useState({});
  const allowed = canViewEvidence(org, reportStatus);

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    setError('');

    try {
      const res = await getEvidenceByReport(org, reportId);
      const data = res || [];

      // 🔥 Fetch files from IPFS
      const urls = {};

      for (const ev of data) {
        try {
          const fileRes = await retrieveFileFromIPFS(org, ev.cid);

          console.log("RAW DATA:", fileRes); // should not be empty

          const blob = new Blob([fileRes], {
            type: ev.fileType || 'image/png'
          });

          console.log("BLOB SIZE:", blob.size); // should be 6826

          const url = URL.createObjectURL(blob);

          urls[ev.cid] = url;

        } catch (err) {
          console.error('File load error:', err);
        }
      }

      setFileUrls(urls);
      setItems(data);

    } catch (e) {
      setError('Could not load evidence: ' + (e?.response?.data?.error || e.message));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [reportId, allowed, org]);

  // Auto-fetch when the section first mounts for this report
  useEffect(() => {
    setItems(null);
    setError('');
    if (allowed) load();
  }, [reportId]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Org3 sees a locked state if report not yet referred
  if (!allowed) {
    return (
      <div className={styles.section}>
        <div className={styles.sLabel}>Evidence</div>
        <div className={styles.evidenceLocked}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <rect x="3" y="7" width="10" height="8" rx="1.5" />
            <path d="M5 7V5a3 3 0 0 1 6 0v2" />
          </svg>
          Evidence is only accessible once this report is marked as <strong>Referred</strong> by the NGO.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.section}>
      <div className={styles.sLabelRow}>
        <div className={styles.sLabel}>Evidence</div>
        {items !== null && !loading && (
          <button className={styles.reloadBtn} onClick={load} title="Refresh evidence">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M10.5 2A5 5 0 1 0 11 6" />
              <path d="M10.5 2V5h-3" />
            </svg>
          </button>
        )}
      </div>

      {loading && (
        <div className={styles.evidenceLoading}><Spinner /></div>
      )}

      {error && !loading && (
        <Alert type="danger">{error}</Alert>
      )}

      {!loading && !error && items !== null && items.length === 0 && (
        <div className={styles.evidenceEmpty}>No evidence files attached to this report.</div>
      )}

      {!loading && !error && items && items.length > 0 && (
        <div className={styles.evidenceGrid}>
          {items.map((ev) => {
            const type = guessType(ev.fileName);
            console.log("TYPE:", type, "FILETYPE:", ev.fileType);
            const src = fileUrls[ev.cid];
            console.log("CID:", ev.cid);
            console.log("SRC:", src);
            return (
              <div key={ev.evidenceId || ev.cid} className={styles.evidenceCard}>
                {type === 'image' && (
                  <button
                    className={styles.evidenceThumbBtn}
                    onClick={() => src && setLightbox(src)}
                  >
                    {src ? (
                      <img
                        src={src}
                        alt={ev.fileName || 'Evidence'}
                        className={styles.evidenceThumb}
                        onError={() => console.error("Image failed to load:", src)}
                      />
                    ) : (
                      <div style={{ padding: 20 }}>Loading...</div>
                    )}

                    <div className={styles.evidenceThumbOverlay}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M10 2h4v4M6 10l8-8M6 6H2v8h8v-4" />
                      </svg>
                    </div>
                  </button>
                )}

                {type === 'pdf' && (
                  <a href={src} target="_blank" rel="noreferrer" className={styles.evidencePdf}>
                    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                      <path d="M13 2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                      <polyline points="13 2 13 9 20 9" />
                    </svg>
                    <span>{ev.fileName || 'Document.pdf'}</span>
                  </a>
                )}

                {type === 'video' && (
                  <video
                    src={src}
                    controls
                    className={styles.evidenceVideo}
                  />
                )}

                <div className={styles.evidenceCaption}>
                  {ev.fileName && <span className={styles.evidenceFilename}>{ev.fileName}</span>}
                  {ev.submittedAt && <span className={styles.evidenceDate}>{fmtShort(ev.submittedAt)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className={styles.lightboxBackdrop} onClick={() => setLightbox(null)}>
          <button className={styles.lightboxClose} onClick={() => setLightbox(null)}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M2 2l14 14M16 2L2 16" />
            </svg>
          </button>
          <img
            src={lightbox}
            alt="Evidence full view"
            className={styles.lightboxImg}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function AllReports() {
  const { currentOrg, notify } = useApp();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [updateModal, setUpdateModal] = useState(null);
  const [auditModal, setAuditModal] = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const canView = currentOrg === 'Org2MSP' || currentOrg === 'Org3MSP';

  useEffect(() => {
    if (!canView) { setLoading(false); return; }
    setLoading(true);
    getAllReports(currentOrg)
      .then(data => setReports(Array.isArray(data) ? data : DEMO))
      .catch(() => setReports(DEMO))
      .finally(() => setLoading(false));
  }, [currentOrg]);

  if (!canView) return <Alert type="danger">Switch to Org2 (NGO) or Org3 (Legal) to manage reports.</Alert>;

  const filtered = reports.filter(r => {
    const matchStatus = !filter || r.status === filter;
    const matchSearch = !search ||
      r.reportId?.toLowerCase().includes(search.toLowerCase()) ||
      r.category?.includes(search.toLowerCase()) ||
      r.description?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  async function handleUpdate() {
    setSaving(true);
    try { await updateReportStatus(currentOrg, updateModal.reportId, newStatus, notes); notify(`Updated to ${newStatus}`); }
    catch { notify('Demo — status updated locally', 'warn'); }
    setReports(rs => rs.map(r =>
      r.reportId === updateModal.reportId ? { ...r, status: newStatus, lastUpdated: new Date().toISOString() } : r
    ));
    if (selected?.reportId === updateModal.reportId)
      setSelected(s => ({ ...s, status: newStatus, lastUpdated: new Date().toISOString() }));
    setSaving(false); setUpdateModal(null); setNotes('');
  }

  async function openAudit(reportId) {
    setAuditModal(reportId); setAuditLoading(true); setAuditLog([]);
    try {
      const log = await getAuditLog(currentOrg, reportId);
      setAuditLog(Array.isArray(log) ? log : []);
    } catch {
      setAuditLog([{ txId: 'tx_' + reportId.slice(0, 8).toLowerCase(), data: { status: 'SUBMITTED', action: 'REPORT_CREATED' } }]);
    } finally { setAuditLoading(false); }
  }

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <input
            className={styles.searchInput}
            placeholder="Search by ID, category, description..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className={styles.filterSelect} value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <span className={styles.count}>{filtered.length} report{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className={styles.loadingWrap}><Spinner /></div>
      ) : (
        <div className={styles.layout}>
          {/* List */}
          <div className={styles.list}>
            {filtered.length === 0 ? <Empty message="No reports found" /> : filtered.map(r => (
              <div
                key={r.reportId}
                className={`${styles.reportCard} ${selected?.reportId === r.reportId ? styles.active : ''}`}
                onClick={() => setSelected(r)}
              >
                <div className={styles.cardTop}>
                  <span className={styles.reportId}>{r.reportId}</span>
                  <StatusBadge status={r.status} />
                </div>
                <div className={styles.cardCat}>{categoryLabel(r.category)}</div>
                <div className={styles.cardDesc}>{r.description?.substring(0, 90)}{r.description?.length > 90 ? '…' : ''}</div>
                <div className={styles.cardMeta}>
                  <span>{fmtShort(r.createdAt)}</span>
                  {r.lastUpdated !== r.createdAt && <span>· upd {fmtShort(r.lastUpdated)}</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Detail */}
          <div className={styles.detail}>
            {!selected ? (
              <div className={styles.noSelect}>
                <div className={styles.noSelectIcon}>◈</div>
                <div>Select a report to view details</div>
              </div>
            ) : (
              <div className="fade-up">
                <div className={styles.detailHeader}>
                  <div>
                    <div className={styles.detailId}>{selected.reportId}</div>
                    <div className={styles.detailCat}>{categoryLabel(selected.category)}</div>
                  </div>
                  <StatusBadge status={selected.status} />
                </div>

                <div className={styles.section}>
                  <div className={styles.sLabel}>Description</div>
                  <div className={styles.sValue}>{selected.description || '—'}</div>
                </div>

                <div className={styles.metaGrid}>
                  <div className={styles.metaItem}>
                    <div className={styles.mLabel}>Submitted</div>
                    <div className={styles.mValue}>{fmt(selected.createdAt)}</div>
                  </div>
                  <div className={styles.metaItem}>
                    <div className={styles.mLabel}>Last Updated</div>
                    <div className={styles.mValue}>{fmt(selected.lastUpdated)}</div>
                  </div>
                  <div className={styles.metaItem}>
                    <div className={styles.mLabel}>Assigned To</div>
                    <div className={styles.mValue}>{selected.assignedTo || 'Unassigned'}</div>
                  </div>
                  <div className={styles.metaItem}>
                    <div className={styles.mLabel}>Evidence Hash</div>
                    <div className={`${styles.mValue} ${styles.mono}`}>{selected.evidenceHash || '—'}</div>
                  </div>
                </div>

                {/* ── Evidence section ── */}
                <EvidenceSection
                  key={selected.reportId}
                  reportId={selected.reportId}
                  reportStatus={selected.status}
                  org={currentOrg}
                />

                {selected.accessLog?.length > 0 && (
                  <div className={styles.section}>
                    <div className={styles.sLabel}>Access History</div>
                    {[...selected.accessLog]
                      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                      .map((log, i) => (
                        <div key={i} className={styles.logRow}>
                          <div className={styles.logDot} />
                          <div className={styles.logContent}>
                            <div className={styles.logHeader}>
                              <span className={styles.logAction}>{log.action?.replace(/_/g, ' ')}</span>
                              {log.newStatus && <span className={styles.logStatus}>→ {log.newStatus}</span>}
                            </div>
                            {log.notes && <div className={styles.logNotes}>{log.notes}</div>}
                            <div className={styles.logMeta}>
                              <span>{log.actor || 'Unknown'}</span>
                              <span>•</span>
                              <span>{log.org}</span>
                              <span>•</span>
                              <span>{fmtShort(log.timestamp)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                <div className={styles.actions}>
                  <Button onClick={() => { setUpdateModal(selected); setNewStatus(selected.status); }}>Update Status</Button>
                  <Button variant="ghost" onClick={() => openAudit(selected.reportId)}>Audit Trail</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {updateModal && (
        <Modal
          title={`Update — ${updateModal.reportId}`}
          onClose={() => setUpdateModal(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setUpdateModal(null)}>Cancel</Button>
              <Button onClick={handleUpdate} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            </>
          }
        >
          <Select label="New Status" value={newStatus} onChange={e => setNewStatus(e.target.value)}>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </Select>
          <Textarea label="Notes" placeholder="Add case notes..." value={notes} onChange={e => setNotes(e.target.value)} />
        </Modal>
      )}

      {auditModal && (
        <Modal
          title={`Audit Trail — ${auditModal}`}
          onClose={() => { setAuditModal(null); setAuditLog([]); }}
          footer={<Button variant="ghost" onClick={() => { setAuditModal(null); setAuditLog([]); }}>Close</Button>}
        >
          {auditLoading ? <Spinner /> : auditLog.length === 0 ? <Empty message="No records found" /> : (
            <div>
              {auditLog.map((entry, i) => (
                <div key={i} className={styles.auditRow}>
                  <div className={styles.auditDot} />
                  <div>
                    <div className={styles.auditAction}>
                      {entry.data?.status ? `Status → ${entry.data.status}` : entry.data?.action || 'Transaction recorded'}
                    </div>
                    <div className={styles.auditMeta}>txId: <span className={styles.mono}>{entry.txId}</span></div>
                  </div>
                </div>
              ))}
              <Alert type="info">Every action is permanently recorded on Hyperledger Fabric.</Alert>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
