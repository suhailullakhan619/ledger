const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function toQuery(params) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') qs.set(key, value);
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

async function request(path, { method = 'GET', body, signal } = {}) {
  let res;
  try {
    res = await fetch(BASE_URL + path, {
      method,
      signal,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the API server. Is the backend running?');
  }

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const err = json?.error;
    throw new ApiError(res.status, err?.code ?? `HTTP_${res.status}`, err?.message ?? res.statusText, err?.details);
  }
  return json;
}

export const api = {
  health: () => request('/health'),
  stats: () => request('/api/stats').then((r) => r.data),

  listAccounts: ({ page = 1, limit = 100 } = {}) => request(`/api/accounts${toQuery({ page, limit })}`),
  getAccount: (id) => request(`/api/accounts/${id}`).then((r) => r.data),
  getBalance: (id) => request(`/api/accounts/${id}/balance`).then((r) => r.data),
  createAccount: (name) => request('/api/accounts', { method: 'POST', body: { name } }).then((r) => r.data),

  listTransactions: (id, { type, page, limit }) =>
    request(`/api/accounts/${id}/transactions${toQuery({ type, page, limit })}`),
  createTransaction: (id, body) => request(`/api/accounts/${id}/transactions`, { method: 'POST', body }),

  transfer: (body) => request('/api/transfers', { method: 'POST', body }).then((r) => r.data),
};

/** Map a VALIDATION_ERROR's details to { field: message } for inline form errors. */
export function fieldErrors(err) {
  if (!(err instanceof ApiError) || !Array.isArray(err.details)) return {};
  return Object.fromEntries(err.details.filter((d) => d.field).map((d) => [d.field, d.message]));
}
