import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { getAllReports, updateReportStatus, getAuditLog } from '../api';
import { Alert, StatusBadge, Button, Select, Textarea, Modal, Spinner, Empty } from '../components/UI';
import styles from './AllReports.module.css';

const STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'EVIDENCE_REQUESTED', 'REFERRED', 'CLOSED_RESOLVED', 'CLOSED_WITHDRAWN'];

const DEMO = [
  { reportId: 'ABDD1B3D67E2054D', category: 'online_harassment', status: 'SUBMITTED', description: 'Received threatening messages online repeatedly over the past week.', evidenceHash: '1212121212', assignedTo: null, createdAt: '2026-03-15T08:37:08.000Z', lastUpdated: '2026-03-15T08:37:08.000Z', accessLog: [] },
  { reportId: 'C5454724CFAA8183', category: 'online_harassment', status: 'SUBMITTED', description: 'Unwanted contact and harassment via social media platforms.', evidenceHash: 'gigig', assignedTo: null, createdAt: '2026-03-15T08:41:59.000Z', lastUpdated: '2026-03-15T08:41:59.000Z', accessLog: [] },
];

function fmt(d) { return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function fmtShort(d) { return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
function categoryLabel(c) {
  const map = { online_harassment: 'Online Harassment', image_abuse: 'Image Abuse', stalking: 'Stalking', threats: 'Threats', doxxing: 'Doxxing', other: 'Other' };
  return map[c] || c?.replace(/_/g, ' ');
}

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
    setReports(rs => rs.map(r => r.reportId === updateModal.reportId ? { ...r, status: newStatus, lastUpdated: new Date().toISOString() } : r));
    if (selected?.reportId === updateModal.reportId) setSelected(s => ({ ...s, status: newStatus, lastUpdated: new Date().toISOString() }));
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
          <input className={styles.searchInput} placeholder="Search by ID, category, description..." value={search} onChange={e => setSearch(e.target.value)} />
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

                {selected.accessLog?.length > 0 && (
                  <div className={styles.section}>
                    <div className={styles.sLabel}>Access History</div>

                    {[...selected.accessLog]
                      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) // newest first
                      .map((log, i) => (
                        <div key={i} className={styles.logRow}>
                          <div className={styles.logDot} />

                          <div className={styles.logContent}>
                            <div className={styles.logHeader}>
                              <span className={styles.logAction}>
                                {log.action?.replace(/_/g, ' ')}
                              </span>

                              {log.newStatus && (
                                <span className={styles.logStatus}>
                                  → {log.newStatus}
                                </span>
                              )}
                            </div>

                            {log.notes && (
                              <div className={styles.logNotes}>
                                {log.notes}
                              </div>
                            )}

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
        <Modal title={`Update — ${updateModal.reportId}`} onClose={() => setUpdateModal(null)}
          footer={<><Button variant="ghost" onClick={() => setUpdateModal(null)}>Cancel</Button><Button onClick={handleUpdate} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button></>}>
          <Select label="New Status" value={newStatus} onChange={e => setNewStatus(e.target.value)}>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </Select>
          <Textarea label="Notes" placeholder="Add case notes..." value={notes} onChange={e => setNotes(e.target.value)} />
        </Modal>
      )}

      {auditModal && (
        <Modal title={`Audit Trail — ${auditModal}`} onClose={() => { setAuditModal(null); setAuditLog([]); }}
          footer={<Button variant="ghost" onClick={() => { setAuditModal(null); setAuditLog([]); }}>Close</Button>}>
          {auditLoading ? <Spinner /> : auditLog.length === 0 ? <Empty message="No records found" /> : (
            <div>
              {auditLog.map((entry, i) => (
                <div key={i} className={styles.auditRow}>
                  <div className={styles.auditDot} />
                  <div>
                    <div className={styles.auditAction}>{entry.data?.status ? `Status → ${entry.data.status}` : entry.data?.action || 'Transaction recorded'}</div>
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
