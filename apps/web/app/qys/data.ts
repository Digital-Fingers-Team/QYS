'use client';

import { useEffect, useState } from 'react';
import type { Paginated } from '@qys/shared';
import { api } from '../../lib/api';

export function field(form: HTMLFormElement, name: string) {
  return String(new FormData(form).get(name) || '').trim();
}

export function num(form: HTMLFormElement, name: string) {
  const value = field(form, name);
  return value ? Number(value) : undefined;
}

export function useData<T>(path: string, token?: string, initial: T | null = null, enabled = true) {
  const [data, setData] = useState<T | null>(initial);
  const [error, setError] = useState('');
  const load = () => enabled ? api<T>(path, undefined, token).then(setData).catch((err) => setError((err as Error).message)) : Promise.resolve();
  useEffect(() => {
    if (token !== undefined && enabled) load();
  }, [path, token, enabled]);
  return { data, setData, error, load };
}

export function pagedPath(path: string, page: number, pageSize: number, q?: string) {
  const [base, query = ''] = path.split('?');
  const params = new URLSearchParams(query);
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  if (q) params.set('q', q);
  return `${base}?${params.toString()}`;
}

export function usePaginatedData<T>(path: string, token?: string, pageSize = 20, q = '', enabled = true) {
  const [page, setPage] = useState(1);
  const requestPath = pagedPath(path, page, pageSize, q.trim() || undefined);
  const { data, error, load } = useData<Paginated<T>>(requestPath, token, { items: [], page, pageSize, total: 0, totalPages: 1 }, enabled);
  useEffect(() => setPage(1), [path, q, pageSize]);
  return { data, items: data?.items || [], page: data?.page || page, totalPages: data?.totalPages || 1, setPage, error, load };
}
