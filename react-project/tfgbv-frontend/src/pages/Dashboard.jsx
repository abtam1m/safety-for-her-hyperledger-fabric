import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { getAllReports } from '../api';
import { StatCard, Card, StatusBadge, UrgencyBadge } from '../components/UI';
import styles from './Pages.module.css';

const DEMO_REPORTS = [
  { reportId:'A1B2C3D4', category:'online_harassment', status:'UNDER_REVIEW', createdAt:'2026-03-14T10:22:00Z', lastUpdated:'2026-03-14T11:00:00Z' },
  { reportId:'E5F6G7H8', category:'image_abuse', status:'REFERRED', createdAt:'2026-03-13T08:10:00Z', lastUpdated:'2026-03-13T15:30:00Z' },
  { reportId:'I9J0K1L2', category:'stalking', status:'SUBMITTED', createdAt:'2026-03-14T09:05:00Z', lastUpdated:'2026-03-14T09:05:00Z' },
];
const DEMO_REFERRALS = [
  { referralId:'REF_E5F6G7H8_cc7h8i9j', reportId:'E5F6G7H8', fromOrg:'Org2MSP', targetOrg:'Org3MSP', urgencyLevel:'HIGH', status:'ACCEPTED' },
];

function fmt(d) {
  return new Date(d).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
}

export default function Dashboard() {
  const { currentOrg } = useApp();
  const [reports, setReports] = useState(DEMO_REPORTS);

  useEffect(() => {
    if (currentOrg !== 'Org1MSP') {
      getAllReports(currentOrg)
        .then(data => {
          // API might return array directly or wrapped in object
          if (Array.isArray(data)) setReports(data);
          else if (data?.result) setReports(data.result);
          else if (data?.reports) setReports(data.reports);
          else setReports(DEMO_REPORTS);
        })
        .catch(() => setReports(DEMO_REPORTS));
    }
  }, [currentOrg]);

  const counts = {
    total:    reports?.length,
    pending:  reports?.filter(r => r.status === 'SUBMITTED').length,
    review:   reports?.filter(r => r.status === 'UNDER_REVIEW').length,
    referred: reports?.filter(r => r.status === 'REFERRED').length,
  };

  return (
    <div className="fade-up">
      <div className={styles.statGrid}>
        <StatCard value={counts.total}    label="Total Reports"   color="var(--accent)" />
        <StatCard value={counts.pending}  label="Pending Review"  color="#7aa2ff" />
        <StatCard value={counts.review}   label="Under Review"    color="var(--warn)" />
        <StatCard value={counts.referred} label="Referred"        color="var(--success)" />
      </div>

      <Card title="Recent Activity">
        <div className={styles.timeline}>
          {reports?.slice(0, 5).map((r, i) => (
            <div key={r.reportId} className={styles.tlItem}>
              <div className={styles.tlDotWrap}>
                <div className={styles.tlDot} />
                {i < reports?.slice(0,5).length - 1 && <div className={styles.tlLine} />}
              </div>
              <div className={styles.tlContent}>
                <div className={styles.tlAction}>
                  Report <span className={styles.mono}>{r.reportId}</span> — <StatusBadge status={r.status} />
                </div>
                <div className={styles.tlMeta}>{r.category.replace(/_/g,' ')} · {fmt(r.lastUpdated)}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className={styles.twoCol}>
        <Card title="Active Referrals">
          {DEMO_REFERRALS.map(r => (
            <div key={r.referralId} className={styles.refRow}>
              <div>
                <div className={styles.mono} style={{ fontSize:'11px' }}>{r.referralId.substring(0,22)}…</div>
                <div className={styles.metaText}>{r.fromOrg} → {r.targetOrg}</div>
              </div>
              <UrgencyBadge level={r.urgencyLevel} />
            </div>
          ))}
        </Card>

        <Card title="Blockchain Info">
          <div className={styles.infoRow}><span className={styles.infoKey}>Channel</span><span className={styles.mono}>mychannel</span></div>
          <div className={styles.infoRow}><span className={styles.infoKey}>Chaincode</span><span className={styles.mono}>testchaincode</span></div>
          <div className={styles.infoRow}><span className={styles.infoKey}>Fabric</span><span className={styles.mono}>v2.5.15</span></div>
          <div className={styles.infoRow}><span className={styles.infoKey}>Orgs</span><span className={styles.mono}>3 (Org1, Org2, Org3)</span></div>
          <div className={styles.infoRow}><span className={styles.infoKey}>DB</span><span className={styles.mono}>CouchDB</span></div>
        </Card>
      </div>
    </div>
  );
}
