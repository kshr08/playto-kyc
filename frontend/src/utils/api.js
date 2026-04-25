const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

function getToken() {
  return localStorage.getItem('playto_token');
}

async function request(method, path, body = null, isFormData = false) {
  const headers = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Token ${token}`;
  if (!isFormData) headers['Content-Type'] = 'application/json';

  const opts = { method, headers };
  if (body) opts.body = isFormData ? body : JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json();

  if (!res.ok) {
    const err = new Error(data.message || 'Request failed');
    err.status = res.status;
    err.detail = data.detail;
    throw err;
  }
  return data;
}

export const api = {
  // Auth
  register: (payload) => request('POST', '/auth/register/', payload),
  login: (payload) => request('POST', '/auth/login/', payload),
  me: () => request('GET', '/auth/me/'),

  // Merchant
  listSubmissions: () => request('GET', '/submissions/'),
  createSubmission: () => request('POST', '/submissions/'),
  getSubmission: (id) => request('GET', `/submissions/${id}/`),
  saveSubmission: (id, data) => request('PATCH', `/submissions/${id}/`, data),
  submitKYC: (id) => request('POST', `/submissions/${id}/submit/`),
  uploadDocument: (id, formData) => request('POST', `/submissions/${id}/documents/`, formData, true),
  deleteDocument: (submissionId, docId) => request('DELETE', `/submissions/${submissionId}/documents/${docId}/`),

  // Reviewer
  getQueue: (state) => request('GET', `/reviewer/queue/${state ? `?state=${state}` : ''}`),
  getReviewerSubmission: (id) => request('GET', `/reviewer/submissions/${id}/`),
  transitionSubmission: (id, payload) => request('POST', `/reviewer/submissions/${id}/transition/`, payload),
  getDashboard: () => request('GET', '/reviewer/dashboard/'),

  // Notifications
  getNotifications: () => request('GET', '/notifications/'),
};
