const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const API_URL = rawApiUrl.replace(/\/$/, '').endsWith('/api')
  ? rawApiUrl.replace(/\/$/, '')
  : `${rawApiUrl.replace(/\/$/, '')}/api`;

export async function api<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {})
    }
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => ({ message: `Request failed (${res.status})` }));
    throw new Error(payload.message || `Request failed (${res.status})`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
