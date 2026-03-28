import axios from 'axios';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// ── Token helpers ────────────────────────────────────────
export const saveToken = (token) => localStorage.setItem('token', token);
export const getToken = () => localStorage.getItem('token');
export const removeToken = () => localStorage.removeItem('token');
export const removeUser = () => localStorage.removeItem('user');
export const saveUser = (user) => localStorage.setItem('user', JSON.stringify(user));
export const getUser = () => JSON.parse(localStorage.getItem('user') || 'null');

const api = axios.create({
  baseURL: BASE,
  headers: { 'Content-Type': 'application/json' },
});
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
api.interceptors.response.use(
  (res) => {
    if (res.config.responseType === 'arraybuffer' || res.config.responseType === 'blob') {
      return res.data;
    }
    const json = res.data;

    if (json.error) throw new Error(json.error);

    const data = json.data ?? json;
    return typeof data === 'string' ? JSON.parse(data) : data;
  },
  (error) => {
    if (error.response?.status === 401) {
      removeToken();
      removeUser();
      window.location.href = '/login'; // optional redirect
    }

    return Promise.reject(error);
  }
);

const orgHeaders = (org) => ({ 'x-org-id': org });

//Auth
export const login = async (username, password) => {
  const data = await api.post('/auth/login', {  username, password } );
  return data;
};

export const logout = async () => {
  await api.post('/auth/logout');
  removeToken();
  removeUser();
}

// Reports
export const createReport = async (body) =>
  await api.post('/reports', body);

export const checkReportStatus = async (reportId, victimToken) =>
   await api.get(`/reports/status/${reportId}`, { params: { victimToken } });

export const getAllReports = async (org) => {
  const data = await api.get('/reports', { headers: orgHeaders(org) });
  return Array.isArray(data) ? data : [];
};

export const getReport = async (org, reportId) =>
  await api.get(`/reports/${reportId}`, { headers: orgHeaders(org) });

export const updateReportStatus = async (org, reportId, status, notes) =>
  await api.patch(`/reports/${reportId}/status`, { status, notes }, { headers: orgHeaders(org) });

export const getAuditLog = async (org, reportId) =>
  await api.get(`/reports/${reportId}/audit`, { headers: orgHeaders(org) });

// Evidence
export const registerEvidence = async (body, org) =>
  await api.post('/evidence', body, { headers: orgHeaders(org) } );

export const verifyEvidence = async (body) =>
  await api.post('/evidence/verify', body);

export const getEvidenceByReport = async (org, reportId) =>
  await api.get(`/evidence/report/${reportId}`, { headers: orgHeaders(org) });

export const markEvidenceVerified = async (evidenceId, notes) =>
  await api.put(`/evidence/${evidenceId}/verify`,  { notes });

export const retrieveFileFromIPFS = async (org, cid) =>
  await api.get(`/evidence/retrieve/${cid}`, { headers: orgHeaders(org), responseType: 'arraybuffer' });
// Referrals
export const createReferral = async (org, body) =>
  await api.post('/referrals', body, { headers: orgHeaders(org) });

export const respondToReferral = async (org, referralId, response, notes) =>
  await api.patch(`/referrals/${referralId}/respond`, {response: response.toUpperCase().trim(), notes }, { headers: orgHeaders(org) });

export const getAllReferrals = async (org) => {
  const data = await api.get('/referrals', { headers: orgHeaders(org) });
  return Array.isArray(data) ? data : [];
}