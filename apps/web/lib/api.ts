const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const withProtocol = /^https?:\/\//.test(rawApiUrl)
  ? rawApiUrl
  : rawApiUrl.startsWith('localhost')
    ? `http://${rawApiUrl}`
    : `https://${rawApiUrl}`;
const API_URL = withProtocol.replace(/\/$/, '').endsWith('/api')
  ? withProtocol.replace(/\/$/, '')
  : `${withProtocol.replace(/\/$/, '')}/api`;

export class ApiClientError extends Error {
  code?: string;
  details?: unknown;
  status: number;

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function errorFromResponse(res: Response) {
  const payload = await res.json().catch(() => ({ message: `Request failed (${res.status})` }));
  return new ApiClientError(res.status, payload.message || `Request failed (${res.status})`, payload.code, payload.details);
}

function apiPath(path: string) {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) throw new ApiClientError(400, 'Invalid API path');
  return `${API_URL}${path}`;
}

function safeDownloadName(name: string) {
  return name.replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 120) || 'download.xlsx';
}

export async function api<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const res = await fetch(apiPath(path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {})
    }
  });

  if (!res.ok) {
    throw await errorFromResponse(res);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function apiForm<T>(path: string, form: FormData, token?: string): Promise<T> {
  const res = await fetch(apiPath(path), {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form
  });
  if (!res.ok) throw await errorFromResponse(res);
  return res.json() as Promise<T>;
}

export async function downloadApi(path: string, token?: string) {
  const res = await fetch(apiPath(path), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });
  if (!res.ok) throw await errorFromResponse(res);
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/);
  return { blob, filename: safeDownloadName(match?.[1] || 'download.xlsx') };
}
