import styles from './UI.module.css';

// ── Button ──────────────────────────────────────────────
export function Button({ children, variant = 'primary', size = 'md', onClick, disabled, type = 'button', style }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={style}
      className={`${styles.btn} ${styles[`btn-${variant}`]} ${styles[`btn-${size}`]}`}
    >
      {children}
    </button>
  );
}

// ── Input ───────────────────────────────────────────────
export function Input({ label, id, hint, ...props }) {
  return (
    <div className={styles.formGroup}>
      {label && <label className={styles.label} htmlFor={id}>{label}</label>}
      <input id={id} className={styles.input} {...props} />
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}

// ── Textarea ────────────────────────────────────────────
export function Textarea({ label, id, hint, ...props }) {
  return (
    <div className={styles.formGroup}>
      {label && <label className={styles.label} htmlFor={id}>{label}</label>}
      <textarea id={id} className={`${styles.input} ${styles.textarea}`} {...props} />
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}

// ── Select ──────────────────────────────────────────────
export function Select({ label, id, children, ...props }) {
  return (
    <div className={styles.formGroup}>
      {label && <label className={styles.label} htmlFor={id}>{label}</label>}
      <select id={id} className={styles.select} {...props}>{children}</select>
    </div>
  );
}

// ── Card ────────────────────────────────────────────────
export function Card({ children, title, style, noPad }) {
  return (
    <div className={styles.card} style={style}>
      {title && <div className={styles.cardTitle}>{title}</div>}
      <div className={noPad ? '' : styles.cardBody}>{children}</div>
    </div>
  );
}

// ── Alert ───────────────────────────────────────────────
export function Alert({ children, type = 'info' }) {
  const icons = {
    info:    'ℹ',
    success: '✓',
    warn:    '⚠',
    danger:  '✕',
  };
  return (
    <div className={`${styles.alert} ${styles[`alert-${type}`]}`}>
      <span className={styles.alertIcon}>{icons[type]}</span>
      <div>{children}</div>
    </div>
  );
}

// ── Badge ───────────────────────────────────────────────
export function Badge({ label, variant = 'default' }) {
  return <span className={`${styles.badge} ${styles[`badge-${variant}`]}`}>{label}</span>;
}

// ── Status Badge ────────────────────────────────────────
export function StatusBadge({ status }) {
  const map = {
    SUBMITTED:        'submitted',
    UNDER_REVIEW:     'review',
    EVIDENCE_REQUESTED: 'warn',
    REFERRED:         'referred',
    CLOSED_RESOLVED:  'resolved',
    CLOSED_WITHDRAWN: 'withdrawn',
  };
  return <Badge label={status.replace(/_/g, ' ')} variant={map[status] || 'default'} />;
}

// ── Urgency Badge ───────────────────────────────────────
export function UrgencyBadge({ level }) {
  const map = { CRITICAL: 'critical', HIGH: 'high', MEDIUM: 'medium', LOW: 'low' };
  return <Badge label={level} variant={map[level] || 'default'} />;
}

// ── Stat Card ───────────────────────────────────────────
export function StatCard({ value, label, color }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statVal} style={{ color }}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}

// ── Token Box ───────────────────────────────────────────
export function TokenBox({ value, color }) {
  function copy() {
    navigator.clipboard.writeText(value);
  }
  return (
    <div className={styles.tokenBox} style={{ color }} onClick={copy} title="Click to copy">
      {value}
      <span className={styles.copyHint}>click to copy</span>
    </div>
  );
}

// ── Divider ─────────────────────────────────────────────
export function Divider() {
  return <hr className={styles.divider} />;
}

// ── Spinner ─────────────────────────────────────────────
export function Spinner() {
  return <div className={styles.spinner} />;
}

// ── Empty State ─────────────────────────────────────────
export function Empty({ message }) {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>◈</div>
      <div className={styles.emptyText}>{message}</div>
    </div>
  );
}

// ── Modal ───────────────────────────────────────────────
export function Modal({ title, children, footer, onClose }) {
  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`${styles.modal} fade-up`}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>{title}</span>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        <div className={styles.modalBody}>{children}</div>
        {footer && <div className={styles.modalFooter}>{footer}</div>}
      </div>
    </div>
  );
}

// ── Table ───────────────────────────────────────────────
export function Table({ columns, data, renderRow }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {data.length === 0
            ? <tr><td colSpan={columns.length}><Empty message="No records found" /></td></tr>
            : data?.map((row, i) => renderRow(row, i))
          }
        </tbody>
      </table>
    </div>
  );
}
