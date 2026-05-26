'use client';
import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function Home() {
  const [token, setToken] = useState<string>('');
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('admin12345');
  const [centers, setCenters] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { api<any[]>('/centers').then(setCenters).catch(()=>{}); }, []);

  async function onLogin(e: FormEvent) {
    e.preventDefault(); setLoading(true); setError('');
    try { const data = await api<{token:string}>('/auth/login', {method:'POST', body: JSON.stringify({email,password})}); setToken(data.token); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  return <main className='max-w-4xl mx-auto p-6 space-y-6'>
    <h1 className='text-3xl font-bold'>QYS Production App</h1>
    <form onSubmit={onLogin} className='bg-white p-4 rounded shadow space-y-2'>
      <input className='border p-2 w-full' value={email} onChange={e=>setEmail(e.target.value)} />
      <input className='border p-2 w-full' type='password' value={password} onChange={e=>setPassword(e.target.value)} />
      <button className='bg-blue-600 text-white px-4 py-2 rounded' disabled={loading}>{loading?'Loading...':'Login'}</button>
      {token && <p className='text-green-600'>Authenticated</p>}
      {error && <p className='text-red-600'>{error}</p>}
    </form>
    <section className='bg-white p-4 rounded shadow'>
      <h2 className='font-semibold mb-2'>Centers</h2>
      <ul className='space-y-1'>{centers.map(c=><li key={c.id}>{c.name} - {c.location}</li>)}</ul>
    </section>
  </main>;
}
