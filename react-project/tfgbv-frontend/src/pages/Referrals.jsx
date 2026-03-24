import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { getAllReferrals, createReferral, respondToReferral } from '../api';
import { getAllReports } from '../api';
import { Card, Button, Select, Textarea, Table, Alert } from '../components/UI';
import styles from './Pages.module.css';

export default function Referrals() {
  const { currentOrg, notify } = useApp();

  const isNGO = currentOrg === 'Org2MSP';
  const isLegal = currentOrg === 'Org3MSP';

  const [reports, setReports] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reason, setReason] = useState('');
  const [urgency, setUrgency] = useState('HIGH');

  useEffect(() => {
    if (isNGO) {
      getAllReports(currentOrg).then(setReports);
    }
  }, [currentOrg]);

  useEffect(() => {
    getAllReferrals(currentOrg).then(setReferrals);
  }, [currentOrg]);

  async function handleCreate() {
    if (!selectedReport) return;

    const data = await createReferral(currentOrg,{
      reportId: selectedReport.reportId,
      reason,
      urgencyLevel: urgency
    });

    setReferrals(prev => [...prev, data]);
    notify('Referral created');
    setSelectedReport(null);
    setReason('');
  }

  async function handleRespond(referralId, response) {
    if (!response) {
      alert('Invalid response');
      return;
    }

    let notes = '';

    if (response === 'REJECTED') {
      notes = prompt('Enter reason for rejection:');
      if (!notes) return;
    }

    try {
      await respondToReferral(currentOrg, referralId, response, notes);
    } catch (err) {
      console.error(err);
    }
  }
  function fmtTime(d) {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  return (
    <div className="fade-up">

      {/*  NGO PANEL */}
      {isNGO && (
        <Card title="Case Selection (NGO)">
          <div className={styles.caseGrid}>
            {reports.map(r => (
              <div
                key={r.reportId}
                className={`${styles.caseCard} ${selectedReport?.reportId === r.reportId ? styles.active : ''}`}
                onClick={() => setSelectedReport(r)}
              >
                <div className={styles.mono}>{r.reportId}</div>
                <div>{r.status}</div>
                <div className={styles.dimText}>
                  {r.description?.slice(0, 80)}
                </div>
              </div>
            ))}
          </div>

          {selectedReport && (
            <div className={styles.preview}>
              <h4>Selected Case</h4>
              <p>{selectedReport.description}</p>
            </div>
          )}

          <Textarea
            placeholder="Referral reason..."
            value={reason}
            onChange={e => setReason(e.target.value)}
          />

          <Select value={urgency} onChange={e => setUrgency(e.target.value)}>
            <option>LOW</option>
            <option>MEDIUM</option>
            <option>HIGH</option>
            <option>CRITICAL</option>
          </Select>

          <Button onClick={handleCreate}>
            Refer to Law Enforcement
          </Button>
        </Card>
      )}

      {/* 🔵 LAW ENFORCEMENT PANEL */}
      <Card title="Referral Dashboard">
        <Table
          columns={['ID', 'Report', 'Urgency', 'Status', 'Reason','Created', 'Updated', 'Action']}
          data={referrals}
          renderRow={(r) => (
            <tr key={r.referralId}>
              <td className={styles.mono}>{}</td>
              <td>{r.reportId}</td>
              <td>{r.urgencyLevel}</td>
              <td>{r.status}</td>
              <td>{r.reason}</td>
              <td className={styles.dimText}>
                {fmtTime(r.createdAt)}
              </td>

             
              <td className={styles.dimText}>
                {fmtTime(r.acceptedAt || r.resolvedAt)}
              </td>
              <td>
                {isLegal && r.status === 'PENDING' && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Button onClick={() => handleRespond(r.referralId, 'ACCEPTED')}>
                      Accept
                    </Button>
                    <Button onClick={() => handleRespond(r.referralId, 'REJECTED')}>
                      Reject
                    </Button>
                  </div>
                )}
              </td>
            </tr>
          )}
        />
      </Card>
    </div>
  );
}