import { useApp } from '../context/AppContext';
import { logout } from '../api';
import styles from './Layout.module.css';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', section: 'Overview' },
  { id: 'submit', label: 'Submit Report', section: 'Reporting' },
  { id: 'track', label: 'Track Case', section: 'Reporting' },
  { id: 'reports', label: 'All Reports', section: 'Case Management', orgOnly: ['Org2MSP', 'Org3MSP'] },
  { id: 'evidence', label: 'Evidence', section: 'Case Management' },
  { id: 'referrals', label: 'Referrals', section: 'Case Management', orgOnly: ['Org2MSP', 'Org3MSP'] },
];

const SECTIONS = [...new Set(NAV.map(n => n.section))];

export default function Layout({ children }) {
  const { user, currentOrg, currentPage, setCurrentPage, notification, signOut } = useApp();

  const pageTitle = NAV.find(n => n.id === currentPage)?.label || 'Dashboard';

  async function handleLogout() {
    try { await logout(); } catch { /* ignore */ }
    signOut();
  }

  return (
    <div className={styles.app}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <div className={styles.logoMark}>
            <div className={styles.logoIcon}>
              <svg viewBox="0 0 16 16" fill="white" width="15" height="15">
                <path d="M8 1L1 4v4c0 4 3.5 7 7 8 3.5-1 7-4 7-8V4L8 1z" />
              </svg>
            </div>
            <div>
              <div className={styles.logoName}>SafeReport</div>
              <div className={styles.logoSub}>fabric v2.5.15</div>
            </div>
          </div>
        </div>

        <nav className={styles.nav}>
          {SECTIONS.map(section => (
            <div key={section} className={styles.navSection}>
              <div className={styles.navLabel}>{section}</div>
              {NAV.filter(n => n.section === section).map(item => {
                const restricted = item.orgOnly && !item.orgOnly.includes(currentOrg);
                return (
                  <button
                    key={item.id}
                    className={`${styles.navItem} ${currentPage === item.id ? styles.active : ''} ${restricted ? styles.restricted : ''}`}
                    onClick={() => !restricted && setCurrentPage(item.id)}
                    title={restricted ? `Requires ${item.orgOnly.join(' or ')}` : ''}
                  >
                    <NavIcon id={item.id} />
                    {item.label}
                    {restricted && <span className={styles.lockIcon}>⊘</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User info + logout at bottom */}
        <div className={styles.userSection}>
          <div className={styles.userInfo}>
            <div className={styles.userAvatar} style={{ background: orgColor(currentOrg) }}>
              {user?.displayName?.[0] || 'U'}
            </div>
            <div className={styles.userDetails}>
              <div className={styles.userName}>{user?.displayName || 'User'}</div>
              <div className={styles.userOrg}>{currentOrg}</div>
            </div>
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout} title="Sign out">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M10 11l3-3-3-3M13 8H6" />
            </svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className={styles.main}>
        <header className={styles.topbar}>
          <div>
            <div className={styles.topbarTitle}>{pageTitle}</div>
            <div className={styles.topbarSub}>mychannel · testchaincode · {currentOrg}</div>
          </div>
          <div className={styles.topbarRight}>
            <div className={styles.chainStatus}>
              <span className={styles.chainDot} />
              network live
            </div>
          </div>
        </header>

        {notification && (
          <div className={`${styles.notification} ${styles[`notif-${notification.type}`]} fade-up`}>
            {notification.message}
          </div>
        )}

        <main className={styles.content}>
          {children}
        </main>
      </div>
    </div>
  );
}



function orgColor(org) {
  return org === 'Org1MSP' ? '#4f7cff' : org === 'Org2MSP' ? '#f5a623' : '#3ecf8e';
}

function NavIcon({ id }) {
  const icons = {
    dashboard: <path d="M1 1h6v6H1zM9 1h6v6H9zM1 9h6v6H1zM9 9h6v6H9z" />,
    submit: <><path d="M8 1v10M4 7l4 4 4-4" /><path d="M2 13h12" /></>,
    track: <><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M8 5v3l2 2" /></>,
    reports: <><path d="M3 2h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M5 6h6M5 9h4" /></>,
    evidence: <><path d="M10 1H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V5l-3-4z" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M9 1v4h4" /></>,
    referrals: <><path d="M2 8h9M8 5l3 3-3 3" /><circle cx="13" cy="8" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" /></>,
  };
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style={{ flexShrink: 0 }}>
      {icons[id]}
    </svg>
  );
}
