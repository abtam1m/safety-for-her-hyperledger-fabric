import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { getToken } from '../api';
import { Alert, Card, Select, Button, TokenBox } from '../components/UI';
import styles from './SubmitReport.module.css';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

async function hashFile(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function fileIcon(type) {
  if (type?.startsWith('image')) return '🖼';
  if (type?.startsWith('video')) return '🎥';
  if (type?.startsWith('audio')) return '🎵';
  return '📄';
}

export default function SubmitReport() {
  const { notify } = useApp();

  const [category, setCategory] = useState('online_harassment');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function handleFilesSelect(e) {
    const selected = Array.from(e.target.files);
    const entries = selected.map(f => ({ file: f, hash: 'hashing…', status: 'hashing' }));
    setFiles(entries);

    for (let i = 0; i < selected.length; i++) {
      const hash = await hashFile(selected[i]);
      setFiles(prev =>
        prev.map((entry, idx) => idx === i ? { ...entry, hash, status: 'ready' } : entry)
      );
    }
  }

  function removeFile(index) {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!description) { setError('Description is required.'); return; }
    if (files.some(f => f.status === 'hashing')) { setError('Please wait for files to finish hashing.'); return; }

    setError(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('description', description);
      formData.append('category', category);
      formData.append('notes', notes);
      files.forEach(({ file }) => formData.append('files', file));

      const res = await fetch(`${BASE}/reports`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });

      const json = await res.json();
      if (json.error) throw new Error(json.error);

      setResult(json.data);
      setDescription(''); setNotes(''); setFiles([]);
      document.getElementById('filesInput').value = '';
      notify('Report submitted to blockchain!');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Success screen ───────────────────────────────────────
  if (result) return (
    <div className="fade-up">
      <Alert type="success">
        Report and {result.evidenceCount} evidence file{result.evidenceCount !== 1 ? 's' : ''} submitted successfully.
      </Alert>

      <Card title="Your Credentials — Save These Now">
        <div className={styles.credLabel}>Report ID</div>
        <TokenBox value={result.reportId} color="var(--accent)" />

        <div className={styles.credLabel} style={{ marginTop: '16px' }}>
          Private Token <span style={{ color: 'var(--danger)', fontWeight: 400 }}>— never shown again</span>
        </div>
        <TokenBox value={result.victimToken} color="var(--success)" />

        <p className={styles.credHint}>
          Your token is never stored on the blockchain. It is the only way to check your case status. Keep it safe.
        </p>

        {result.evidence?.length > 0 && (
          <div className={styles.evidenceSummary}>
            <div className={styles.evSumTitle}>Evidence registered on chain</div>
            {result.evidence.map((ev, i) => (
              <div key={i} className={styles.evSumRow}>
                <div className={styles.evSumName}>{ev.fileName}</div>
                <div className={styles.evSumMeta}>
                  <span className={styles.mono}>{ev.evidenceId}</span>
                  <a
                    href={`https://gateway.pinata.cloud/ipfs/${ev.cid}`}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.ipfsLink}
                  >
                    View on IPFS ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '16px' }}>
          <Button onClick={() => setResult(null)}>Submit Another Report</Button>
        </div>
      </Card>
    </div>
  );

  // ── Form ─────────────────────────────────────────────────
  return (
    <div className="fade-up">
      <Alert type="warn">
        Your identity is never stored. A one-time private token will be generated — save it immediately.
      </Alert>

      <Card title="Anonymous Incident Report">
        <Select
          label="Incident Category"
          id="category"
          value={category}
          onChange={e => setCategory(e.target.value)}
        >
          <option value="online_harassment">Online Harassment</option>
          <option value="image_abuse">Non-consensual Image Abuse</option>
          <option value="stalking">Stalking / Monitoring</option>
          <option value="threats">Threats & Intimidation</option>
          <option value="doxxing">Doxxing</option>
          <option value="other">Other</option>
        </Select>

        <div className={styles.formGroup}>
          <label className={styles.label}>
            What happened?
            <span className={styles.labelHint}> — do not include your real name</span>
          </label>
          <textarea
            className={styles.textarea}
            placeholder="Describe the incident in as much detail as you feel safe sharing..."
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>
            Additional Notes
            <span className={styles.optional}> (optional)</span>
          </label>
          <textarea
            className={`${styles.textarea} ${styles.textareaSm}`}
            placeholder="Any other context, urgency, or requests..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        {/* File upload */}
        <div className={styles.formGroup}>
          <label className={styles.label}>
            Attach Evidence
            <span className={styles.optional}> — screenshots, videos, documents (optional)</span>
          </label>

          <div
            className={styles.dropZone}
            onClick={() => document.getElementById('filesInput').click()}
            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add(styles.dragOver); }}
            onDragLeave={e => e.currentTarget.classList.remove(styles.dragOver)}
            onDrop={e => {
              e.preventDefault();
              e.currentTarget.classList.remove(styles.dragOver);
              handleFilesSelect({ target: { files: e.dataTransfer.files } });
            }}
          >
            <div className={styles.dropIcon}>⬆</div>
            <div className={styles.dropText}>Click or drag files here</div>
            <div className={styles.dropHint}>Multiple files supported · Max 50MB each</div>
            <input
              id="filesInput"
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={handleFilesSelect}
            />
          </div>

          {files.length > 0 && (
            <div className={styles.fileList}>
              {files.map((entry, i) => (
                <div key={i} className={styles.fileRow}>
                  <div className={styles.fileIcon}>{fileIcon(entry.file.type)}</div>
                  <div className={styles.fileInfo}>
                    <div className={styles.fileName}>{entry.file.name}</div>
                    <div className={styles.fileMeta}>
                      {(entry.file.size / 1024).toFixed(1)} KB ·{' '}
                      {entry.status === 'hashing'
                        ? <span className={styles.hashing}>hashing…</span>
                        : <span className={styles.hashed}>✓ {entry.hash.substring(0, 16)}…</span>
                      }
                    </div>
                  </div>
                  <button className={styles.removeBtn} onClick={() => removeFile(i)}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <Alert type="danger">{error}</Alert>}

        <Button
          onClick={handleSubmit}
          disabled={loading || files.some(f => f.status === 'hashing')}
          size="lg"
        >
          {loading
            ? files.length > 0
              ? `Uploading ${files.length} file${files.length > 1 ? 's' : ''} & submitting…`
              : 'Submitting to blockchain…'
            : `Submit Report${files.length > 0 ? ` + ${files.length} file${files.length > 1 ? 's' : ''}` : ''}`
          }
        </Button>
      </Card>
    </div>
  );
}
