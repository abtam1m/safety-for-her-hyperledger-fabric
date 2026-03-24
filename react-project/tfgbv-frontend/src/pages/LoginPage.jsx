import { useState } from 'react';
import { login, saveToken, saveUser } from '../api';
import { useApp } from '../context/AppContext';
import styles from './LoginPage.module.css';

const DEMO_ACCOUNTS = [
  { username: 'handler', password: 'ngo1234', role: 'NGO Case Handler', org: 'Org2MSP', color: '#f5a623' },
  { username: 'authority', password: 'legal1234', role: 'Legal Authority', org: 'Org3MSP', color: '#3ecf8e' },
];

export default function LoginPage() {
  const { setUser } = useApp();
  const [tab, setTab] = useState('login'); // 'login' | 'signup'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  function switchTab(t) {
    setTab(t);
    setError(null);
    setSuccess(null);
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setDisplayName('');
  }

  async function handleLogin(e) {
    e.preventDefault();
    if (!username || !password) { setError('Both fields are required.'); return; }
    setError(null); setLoading(true);
    try {
      const data = await login(username, password);
      saveToken(data.token);
      saveUser(data.user);
      setUser(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e) {
    e.preventDefault();
    if (!username || !password) { setError('All fields are required.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setError(null); setLoading(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, displayName: displayName || 'Anonymous' }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSuccess('Account created! You can now sign in.');
      setTimeout(() => switchTab('login'), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function quickLogin(u, p) {
    setUsername(u);
    setPassword(p);
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* Logo */}
        <div className={styles.logoWrap}>
          <div className={styles.logoIcon}>
            <svg viewBox="0 0 16 16" fill="white" width="22" height="22">
              <path d="M8 1L1 4v4c0 4 3.5 7 7 8 3.5-1 7-4 7-8V4L8 1z" />
            </svg>
          </div>
          <div className={styles.logoName}>SafeReport</div>
          <div className={styles.logoSub}>Secure · Anonymous · Accountable</div>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === 'login' ? styles.tabActive : ''}`}
            onClick={() => switchTab('login')}
          >
            Sign In
          </button>
          <button
            className={`${styles.tab} ${tab === 'signup' ? styles.tabActive : ''}`}
            onClick={() => switchTab('signup')}
          >
            New Victim Account
          </button>
        </div>

        {/* Login Form */}
        {tab === 'login' && (
          <form onSubmit={handleLogin} className={styles.form}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Username</label>
              <input
                className={styles.input}
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter username"
                autoComplete="username"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Password</label>
              <input
                type="password"
                className={styles.input}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
              />
            </div>
            {error && <div className={styles.error}>{error}</div>}
            <button type="submit" className={styles.loginBtn} disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>

            <div className={styles.divider}>Quick access for demo</div>
            <div className={styles.quickLogins}>
              {DEMO_ACCOUNTS.map(a => (
                <button
                  key={a.username}
                  type="button"
                  className={`${styles.quickBtn} ${username === a.username ? styles.quickBtnActive : ''}`}
                  onClick={() => quickLogin(a.username, a.password)}
                >
                  <div className={styles.quickDot} style={{ background: a.color }} />
                  <div>
                    <div className={styles.quickRole}>{a.role}</div>
                    <div className={styles.quickCred}>{a.username} / {a.password}</div>
                  </div>
                  <div className={styles.quickOrg}>{a.org}</div>
                </button>
              ))}
            </div>
          </form>
        )}

        {/* Signup Form */}
        {tab === 'signup' && (
          <form onSubmit={handleSignup} className={styles.form}>
            <div className={styles.signupInfo}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1L1 4v4c0 4 3.5 7 7 8 3.5-1 7-4 7-8V4L8 1z" />
              </svg>
              Your identity is never stored on the blockchain. Choose any username — it does not need to be your real name.
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>
                Username <span className={styles.labelHint}>(does not need to be your real name)</span>
              </label>
              <input
                className={styles.input}
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Choose any username"
                autoComplete="username"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>
                Display Name <span className={styles.labelHint}>(optional)</span>
              </label>
              <input
                className={styles.input}
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Leave blank to stay fully anonymous"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Password <span className={styles.labelHint}>(min 8 characters)</span></label>
              <input
                type="password"
                className={styles.input}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Choose a strong password"
                autoComplete="new-password"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Confirm Password</label>
              <input
                type="password"
                className={styles.input}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat your password"
                autoComplete="new-password"
              />
            </div>

            {error && <div className={styles.error}>{error}</div>}
            {success && <div className={styles.successMsg}>{success}</div>}

            <button type="submit" className={styles.loginBtn} disabled={loading}>
              {loading ? 'Creating account…' : 'Create Anonymous Account'}
            </button>

            <div className={styles.signupFooter}>
              Already have an account?{' '}
              <button type="button" className={styles.linkBtn} onClick={() => switchTab('login')}>
                Sign in
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
