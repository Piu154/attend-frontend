// One place that talks to the backend. Every screen calls api(...) instead of fetch(...).
const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = 'GET', body, token, adminKey } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (adminKey) headers['x-admin-key'] = adminKey;

  let res;
  try {
    res = await fetch(API + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Cannot reach the server. Is the backend running?', 0);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // the backend sends a list of messages for validation errors
    const message = Array.isArray(data.message) ? data.message.join(', ') : data.message;
    throw new ApiError(message || 'Something went wrong', res.status);
  }
  return data;
}