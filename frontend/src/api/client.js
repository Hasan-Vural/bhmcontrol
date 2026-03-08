// API temel adresi:
// - Development'ta: doğrudan backend'e (http://localhost:3001/api)
// - Production'da: aynı origin altındaki /api (reverse proxy ile)
const API_BASE =
  (import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  (import.meta.env && import.meta.env.DEV ? 'http://localhost:3001/api' : '/api');

let authToken = null;

export function setAuthToken(token) {
  authToken = token;
}

async function request(path, options = {}) {
  // FormData için Content-Type header'ını otomatik ayarlamayı bırak
  const isFormData = options.body instanceof FormData;
  const baseHeaders = isFormData
    ? { ...options.headers }
    : { 'Content-Type': 'application/json', ...options.headers };

  const headers =
    authToken != null
      ? { ...baseHeaders, Authorization: `Bearer ${authToken}` }
      : baseHeaders;

  const res = await fetch(`${API_BASE}${path}`, {
    headers,
    ...options,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export const api = {
  setAuthToken,
  machines: {
    list: () => request('/machines'),
    get: (id) => request(`/machines/${id}`),
    create: (body) => request('/machines', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => request(`/machines/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id) => request(`/machines/${id}`, { method: 'DELETE' }),
  },
  faultCodes: {
    list: (params) => request('/fault-codes' + (params ? '?' + new URLSearchParams(params) : '')),
    get: (id) => request(`/fault-codes/${id}`),
    create: (body) => request('/fault-codes', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => request(`/fault-codes/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id) => request(`/fault-codes/${id}`, { method: 'DELETE' }),
  },
  resolutions: {
    list: (params) => request('/resolutions' + (params ? '?' + new URLSearchParams(params) : '')),
    get: (id) => request(`/resolutions/${id}`),
    create: (body) => request('/resolutions', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => request(`/resolutions/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id) => request(`/resolutions/${id}`, { method: 'DELETE' }),
  },
  alerts: {
    list: (params) => request('/alerts' + (params ? '?' + new URLSearchParams(params) : '')),
    get: (id) => request(`/alerts/${id}`),
    count: (params) => request('/alerts/count' + (params ? '?' + new URLSearchParams(params) : '')),
    create: (body) => request('/alerts', { method: 'POST', body: JSON.stringify(body) }),
    createTest: () => request('/alerts/test', { method: 'POST' }),
    update: (id, body) => request(`/alerts/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  },
  sensorMock: {
    latest: () => request('/sensor-mock/latest'),
    latestByMachine: (machineId) => request(`/sensor-mock/latest/${machineId}`),
  },
  docs: {
    list: () => request('/docs'),
    ask: (question) => request('/docs/ask', { method: 'POST', body: JSON.stringify({ question }) }),
    upload: (formData) => request('/docs/upload', { method: 'POST', headers: {}, body: formData }),
    delete: (filename) => request(`/docs/${filename}`, { method: 'DELETE' }),
  },
  ai: {
    query: (body) => request('/ai/query', { method: 'POST', body: JSON.stringify(body) }),
    feedback: (body) => request('/ai/feedback', { method: 'POST', body: JSON.stringify(body) }),
  },
  /** Tarayıcıda açılacak doküman URL'si (backend docs-public). */
  docsPublicOpenUrl: (name, page) => {
    const base = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || (import.meta.env?.DEV ? 'http://localhost:3001/api' : '/api');
    const url = `${base}/docs-public/open?name=${encodeURIComponent(name)}`;
    return page != null && page !== '' ? `${url}&page=${encodeURIComponent(String(page))}` : url;
  },
  /** PDF sayfa önizleme görseli URL'si (snippet için) */
  docsPublicPagePreviewUrl(name, page) {
    const base = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || (import.meta.env?.DEV ? 'http://localhost:3001/api' : '/api');
    const url = `${base}/docs-public/page-preview?name=${encodeURIComponent(name)}`;
    return page != null && page !== '' ? `${url}&page=${encodeURIComponent(String(page))}` : url;
  },
  /** Dosya var mı kontrol eder; varsa açılacak tam URL döner. Yoksa { ok: false, error } */
  async docsPublicResolve(name, page) {
    const base = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || (import.meta.env?.DEV ? 'http://localhost:3001/api' : '/api');
    const q = `name=${encodeURIComponent(name)}${page != null && page !== '' ? '&page=' + encodeURIComponent(String(page)) : ''}`;
    try {
      const res = await fetch(`${base}/docs-public/resolve?${q}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok && data.url) {
        const url = data.url.startsWith('http') ? data.url : base.replace(/\/api\/?$/, '') + data.url;
        return { ok: true, url };
      }
      return { ok: false, error: data.error || 'Dosya bulunamadı.' };
    } catch (e) {
      return { ok: false, error: e.message || 'Bağlantı hatası.' };
    }
  },
  workOrders: {
    list: (params) => request('/work-orders' + (params ? '?' + new URLSearchParams(params) : '')),
    get: (id) => request(`/work-orders/${id}`),
    create: (body) => request('/work-orders', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => request(`/work-orders/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  },
  analytics: {
    overview: (params) => request('/analytics/overview' + (params ? '?' + new URLSearchParams(params) : '')),
    machineRanking: (params) => request('/analytics/machine-ranking' + (params ? '?' + new URLSearchParams(params) : '')),
    aiUsage: (params) => request('/analytics/ai-usage' + (params ? '?' + new URLSearchParams(params) : '')),
  },
  authMe: () => request('/auth/me'),
  authLogin: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  authLogout: () => request('/auth/logout', { method: 'POST' }),
  authImpersonate: (body) => request('/auth/test-login', { method: 'POST', body: JSON.stringify(body) }),
  authVerifyTestHesap: (password) =>
    request('/auth/verify-test-hesap', { method: 'POST', body: JSON.stringify({ password }) }),
  testHesap: {
    users: (token) =>
      request('/test-hesap/users', {
        headers: token ? { 'X-Test-Hesap-Token': token } : {},
      }),
    impersonate: (userId, token) =>
      request('/auth/test-login', {
        method: 'POST',
        body: JSON.stringify({ userId }),
        headers: token ? { 'X-Test-Hesap-Token': token } : {},
      }),
  },
  admin: {
    users: {
      list: () => request('/admin/users'),
      create: (body) => request('/admin/users', { method: 'POST', body: JSON.stringify(body) }),
      update: (id, body) => request(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
      delete: (id) => request(`/admin/users/${id}`, { method: 'DELETE' }),
    },
  },
  conversations: {
    list: () => request('/conversations'),
    create: (body) => request('/conversations', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => request(`/conversations/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  },
  sirketHafizasi: {
    create: (body) => request('/sirket-hafizasi', { method: 'POST', body: JSON.stringify(body) }),
    pending: () => request('/sirket-hafizasi/pending'),
    approve: (id) => request(`/sirket-hafizasi/${id}/approve`, { method: 'PATCH', body: JSON.stringify({}) }),
    reject: (id, reason) =>
      request(`/sirket-hafizasi/${id}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ reason }),
      }),
  },
  docChat: {
    query: (body) => request('/doc-chat/query', { method: 'POST', body: JSON.stringify(body) }),
    listConversations: (documentName) =>
      request(`/doc-chat/conversations?documentName=${encodeURIComponent(documentName)}`),
    getConversation: (id) => request(`/doc-chat/conversations/${id}`),
    createConversation: (body) =>
      request('/doc-chat/conversations', { method: 'POST', body: JSON.stringify(body) }),
    deleteConversation: (id) => request(`/doc-chat/conversations/${id}`, { method: 'DELETE' }),
  },
};
