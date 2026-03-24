import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { verifyEvidence, markEvidenceVerified, getToken } from '../api/index';
import { Alert, Card, Input, Button, Modal, Spinner } from '../components/UI';
import styles from './Evidence.module.css';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

async function hashFile(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export default function Evidence() {
  const { currentOrg, notify } = useApp();

  // Upload state
  const [file, setFile] = useState(null);
  const [fileHash, setFileHash] = useState('');
  const [reportId, setReportId] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState(null);

  // Retrieve state
  const [searchId, setSearchId] = useState('');
  const [evidenceList, setEvidenceList] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  // Preview state
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewType, setPreviewType] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewEvidenceId, setPreviewEvidenceId] = useState(null);

  // Verify modal
  const [verifyModal, setVerifyModal] = useState(false);
  const [verifyId, setVerifyId] = useState('');
  const [verifyHash, setVerifyHash] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);

  const canView = currentOrg === 'Org2MSP' || currentOrg === 'Org3MSP';
  const canVerify = currentOrg === 'Org3MSP';

  async function handleFileSelect(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setFileHash('Hashing…');
    setUploadResult(null);
    const hash = await hashFile(f);
    setFileHash(hash);
  }

  async function handleUpload() {
    if (!file || !reportId) { setUploadError('File and Report ID are required.'); return; }
    if (fileHash === 'Hashing…') { setUploadError('Please wait for file hash to complete.'); return; }
    setUploadError(null); setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('reportId', reportId);
      formData.append('description', description);

      const res = await fetch(`${BASE}/evidence/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      setUploadResult(json.data);
      notify('Uploaded to IPFS and registered on blockchain!');
      setFile(null); setFileHash(''); setReportId(''); setDescription('');
      document.getElementById('fileInput').value = '';
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function fetchEvidence() {
    if (!searchId) return;
    setLoadingList(true); setEvidenceList([]);
    try {
      const res = await fetch(`${BASE}/evidence/report/${searchId}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const json = await res.json();
      const data = typeof json.data === 'string' ? JSON.parse(json.data) : json.data;
      setEvidenceList(Array.isArray(data) ? data : []);
    } catch {
      setEvidenceList([]);
      notify('Could not fetch evidence', 'danger');
    } finally {
      setLoadingList(false);
    }
  }

  async function previewFile(ev) {
    if (previewEvidenceId === ev.evidenceId) { setPreviewUrl(null); setPreviewEvidenceId(null); return; }
    setPreviewLoading(true); setPreviewUrl(null); setPreviewEvidenceId(ev.evidenceId); setPreviewType(ev.fileType);
    try {
      const res = await fetch(`${BASE}/evidence/retrieve/${ev.cid}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const blob = await res.blob();
      setPreviewUrl(URL.createObjectURL(blob));
    } catch {
      notify('Could not retrieve file from IPFS', 'danger');
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleMarkVerified(evidenceId) {
    try { await markEvidenceVerified(evidenceId, ''); } catch { /* demo */ }
    setEvidenceList(ev => ev.map(e => e.evidenceId === evidenceId ? { ...e, verified: true } : e));
    notify('Evidence marked as verified on blockchain');
  }

  async function handleVerify() {
    try {
      const data = await verifyEvidence({ evidenceId: verifyId, fileHash: verifyHash });
      setVerifyResult(data);
    } catch (e) {
      setVerifyResult({ isIntact: false, message: e.message });
    }
  }

  return (
    <div className={styles.container}>
      {/* Upload */}
      <Card title="Upload Evidence to IPFS + Blockchain">
        <Alert type="info">
          Your file is hashed in your browser first. Only the hash and IPFS CID are stored on-chain.
          Org2 and Org3 can retrieve the actual file using the CID.
        </Alert>

        <div className={styles.uploadArea} onClick={() => document.getElementById('fileInput').click()}>
          {file ? (
            <div className={styles.fileSelected}>
              <div className={styles.fileName}>{file.name}</div>
              <div className={styles.fileSize}>{(file.size / 1024).toFixed(1)} KB · {file.type}</div>
            </div>
          ) : (
            <>
              <div className={styles.uploadIcon}>⬆</div>
              <div className={styles.uploadText}>Click to select file</div>
              <div className={styles.uploadHint}>Images, videos, documents — max 50MB</div>
            </>
          )}
          <input id="fileInput" type="file" style={{ display: 'none' }} onChange={handleFileSelect} />
        </div>

        {fileHash && (
          <div className={styles.hashRow}>
            <span className={styles.hashLabel}>SHA-256</span>
            <span className={styles.hashValue}>
              {fileHash === 'Hashing…' ? <span style={{ color: 'var(--warn)' }}>Hashing…</span> : fileHash}
            </span>
          </div>
        )}

        <div className={styles.twoCol}>
          <div>
            <label className={styles.label}>Report ID *</label>
            <input className={styles.input} placeholder="ABDD1B3D67E2054D" value={reportId} onChange={e => setReportId(e.target.value)} />
          </div>
          <div>
            <label className={styles.label}>Description</label>
            <input className={styles.input} placeholder="Brief description..." value={description} onChange={e => setDescription(e.target.value)} />
          </div>
        </div>

        {uploadError && <Alert type="danger">{uploadError}</Alert>}
        {uploadResult && (
          <Alert type="success">
            Registered on blockchain!<br />
            Evidence ID: <span className={styles.mono}>{uploadResult.evidenceId}</span><br />
            IPFS CID: <span className={styles.mono}>{uploadResult.cid}</span>
          </Alert>
        )}

        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          <Button onClick={handleUpload} disabled={uploading || !file || fileHash === 'Hashing…'}>
            {uploading ? 'Uploading to IPFS…' : 'Upload & Register on Chain'}
          </Button>
          <Button variant="ghost" onClick={() => { setVerifyModal(true); setVerifyResult(null); setVerifyHash(''); }}>
            Verify File Integrity
          </Button>
        </div>
      </Card>

      {/* Retrieve — Org2/Org3 only */}
      {canView && (
        <Card title="Retrieve Evidence from Blockchain + IPFS">
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', marginBottom: '16px' }}>
            <div style={{ flex: 1 }}>
              <label className={styles.label}>Report ID</label>
              <input
                className={styles.input}
                placeholder="Enter report ID..."
                value={searchId}
                onChange={e => setSearchId(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchEvidence()}
              />
            </div>
            <Button onClick={fetchEvidence}>Fetch Evidence</Button>
          </div>

          {loadingList ? <Spinner /> : evidenceList.length > 0 && (
            <div className={styles.evList}>
              {evidenceList.map(ev => (
                <div key={ev.evidenceId} className={styles.evCard}>
                  <div className={styles.evHeader}>
                    <div>
                      <div className={styles.evId}>{ev.evidenceId}</div>
                      <div className={styles.evSub}>{ev.fileName} · {ev.fileType}</div>
                    </div>
                    <span className={`${styles.evBadge} ${ev.verified ? styles.verified : styles.pending}`}>
                      {ev.verified ? 'VERIFIED' : 'PENDING'}
                    </span>
                  </div>

                  <div className={styles.evMeta}>
                    <div className={styles.evMetaRow}>
                      <span className={styles.evKey}>CID</span>
                      <span className={styles.mono}>
                        {ev.cid}
                        <a href={`https://gateway.pinata.cloud/ipfs/${ev.cid}`} target="_blank" rel="noreferrer" className={styles.ipfsLink}> ↗ IPFS</a>
                      </span>
                    </div>
                    <div className={styles.evMetaRow}>
                      <span className={styles.evKey}>Hash</span>
                      <span className={styles.mono}>{ev.fileHash?.substring(0, 40)}…</span>
                    </div>
                    <div className={styles.evMetaRow}>
                      <span className={styles.evKey}>Submitted</span>
                      <span>{new Date(ev.submittedAt).toLocaleString()}</span>
                    </div>
                    {ev.description && (
                      <div className={styles.evMetaRow}>
                        <span className={styles.evKey}>Note</span>
                        <span>{ev.description}</span>
                      </div>
                    )}
                  </div>

                  <div className={styles.evActions}>
                    <Button variant="ghost" size="sm" onClick={() => previewFile(ev)}>
                      {previewLoading && previewEvidenceId === ev.evidenceId ? 'Loading…' :
                        previewEvidenceId === ev.evidenceId ? 'Hide File' : 'View File'}
                    </Button>
                    {canVerify && !ev.verified && (
                      <Button variant="success" size="sm" onClick={() => handleMarkVerified(ev.evidenceId)}>
                        Mark Verified
                      </Button>
                    )}
                  </div>

                  {/* Inline preview */}
                  {previewUrl && previewEvidenceId === ev.evidenceId && (
                    <div className={styles.preview}>
                      {previewType?.startsWith('image') ? (
                        <img src={previewUrl} alt="evidence" className={styles.previewImg} />
                      ) : previewType?.startsWith('video') ? (
                        <video src={previewUrl} controls className={styles.previewImg} />
                      ) : previewType?.startsWith('audio') ? (
                        <audio src={previewUrl} controls style={{ width: '100%' }} />
                      ) : (
                        <div className={styles.previewDoc}>
                          <a href={previewUrl} download={ev.fileName} className={styles.downloadLink}>
                            Download {ev.fileName}
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Verify Modal */}
      {verifyModal && (
        <Modal
          title="Verify File Integrity"
          onClose={() => setVerifyModal(false)}
          footer={<>
            <Button variant="ghost" onClick={() => setVerifyModal(false)}>Close</Button>
            <Button onClick={handleVerify} disabled={!verifyId || !verifyHash}>Verify</Button>
          </>}
        >
          <Input label="Evidence ID" placeholder="EVD_..." value={verifyId} onChange={e => setVerifyId(e.target.value)} />
          <div style={{ marginBottom: '14px' }}>
            <label className={styles.label}>Upload file to verify</label>
            <input type="file" style={{ color: 'var(--text2)', fontSize: '12px', display: 'block' }}
              onChange={async e => {
                const f = e.target.files[0];
                if (f) { const h = await hashFile(f); setVerifyHash(h); }
              }}
            />
          </div>
          {verifyHash && (
            <div className={styles.hashRow} style={{ marginBottom: '14px' }}>
              <span className={styles.hashLabel}>Hash</span>
              <span className={styles.hashValue}>{verifyHash}</span>
            </div>
          )}
          {verifyResult && (
            <Alert type={verifyResult.isIntact ? 'success' : 'danger'}>{verifyResult.message}</Alert>
          )}
        </Modal>
      )}
    </div>
  );
}
