'use client';

import { useState } from 'react';
import type { Center } from './types';

export function CenterSelect({ centers, defaultValue = '', required = false }: { centers: Center[]; defaultValue?: number | string | null; required?: boolean }) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = centers.filter((center) => `${center.name} ${center.location}`.toLowerCase().includes(normalizedQuery));

  return (
    <div className="grid">
      <input className="input" type="search" placeholder="ابحث عن المركز أو المنطقة" value={query} onChange={(e) => setQuery(e.target.value)} />
      <select className="select" name="centerId" defaultValue={defaultValue || ''} required={required}>
        <option value="">{required ? 'اختر المركز التابع له' : 'بدون مركز'}</option>
        {filtered.map((center) => <option key={center.id} value={center.id}>{center.name} - {center.location}</option>)}
      </select>
    </div>
  );
}

export function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="page-header fade-in">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
    </div>
  );
}

export function PaginationControls({ page, totalPages, setPage }: { page: number; totalPages: number; setPage: (page: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="actions" style={{ marginTop: 16 }}>
      <button className="btn" type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>السابق</button>
      <span className="muted">{page} / {totalPages}</span>
      <button className="btn" type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>التالي</button>
    </div>
  );
}
