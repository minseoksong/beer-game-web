// 단순 fetch 래퍼

async function request(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `요청 실패 (${res.status})`);
  }
  return data;
}

export const api = {
  health: () => request('/api/health'),
  createSession: (body) =>
    request('/api/sessions', { method: 'POST', body: JSON.stringify(body) }),
  getSessionByCode: (code) =>
    request(`/api/sessions/code/${encodeURIComponent(code)}`),
  getSessionResults: (code) =>
    request(`/api/sessions/code/${encodeURIComponent(code)}/results`),
  getAdminSession: (id, token) =>
    request(`/api/sessions/${id}?token=${encodeURIComponent(token)}`),
  joinTeam: (teamId, body) =>
    request(`/api/teams/${teamId}/join`, { method: 'POST', body: JSON.stringify(body) }),
  getMe: (token) =>
    request('/api/teams/me', { headers: { 'X-Player-Token': token } }),
  startSession: (id, token) =>
    request(`/api/sessions/${id}/start?token=${encodeURIComponent(token)}`, { method: 'POST' }),
  finishSession: (id, token) =>
    request(`/api/sessions/${id}/finish?token=${encodeURIComponent(token)}`, { method: 'POST' }),
  forceAdvance: (sessionId, teamId, token) =>
    request(`/api/sessions/${sessionId}/teams/${teamId}/force-advance?token=${encodeURIComponent(token)}`, { method: 'POST' }),
  getTeamDetail: (sessionId, teamId, token) =>
    request(`/api/sessions/${sessionId}/teams/${teamId}?token=${encodeURIComponent(token)}`),
  exportCsvUrl: (sessionId, token) =>
    `/api/sessions/${sessionId}/export.csv?token=${encodeURIComponent(token)}`
};
