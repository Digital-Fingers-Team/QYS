const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
export async function api<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { ...init, headers: { 'Content-Type':'application/json', ...(token?{Authorization:`Bearer ${token}`}:{}) } });
  if (!res.ok) throw new Error((await res.json()).message || 'Request failed');
  return res.json();
}
