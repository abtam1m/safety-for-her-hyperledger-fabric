export const saveCase = (reportId, token) => {
  const existing = JSON.parse(localStorage.getItem('victimCases') || '[]');

  const updated = [
    ...existing.filter(c => c.reportId !== reportId),
    { reportId, token }
  ];

  localStorage.setItem('victimCases', JSON.stringify(updated));
};

export const getCases = () => {
  return JSON.parse(localStorage.getItem('victimCases') || '[]');
};

export const removeCase = (reportId) => {
  const existing = getCases().filter(c => c.reportId !== reportId);
  localStorage.setItem('victimCases', JSON.stringify(existing));
};