import { AppProvider, useApp } from './context/AppContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import SubmitReport from './pages/SubmitReport';
import TrackCase from './pages/TrackCase';
import AllReports from './pages/AllReports';
import Evidence from './pages/Evidence';
import Referrals from './pages/Referrals';
import './index.css';

function Pages() {
  const { currentPage } = useApp();
  const map = {
    dashboard: <Dashboard />,
    submit: <SubmitReport />,
    track: <TrackCase />,
    reports: <AllReports />,
    evidence: <Evidence />,
    referrals: <Referrals />,
  };
  return map[currentPage] || <Dashboard />;
}

function AppShell() {
  const { user } = useApp();
  if (!user) return <LoginPage />;
  return <Layout><Pages /></Layout>;
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
