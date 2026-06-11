'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { User } from './types';

const storageKey = 'qys_session';
const sessionUpdatedEvent = 'qys_session_updated';

export function readSession(): { token: string; user: User } | null {
  if (typeof window === 'undefined') return null;
  const saved = window.sessionStorage.getItem(storageKey);
  if (!saved) return null;
  try {
    return JSON.parse(saved);
  } catch {
    window.sessionStorage.removeItem(storageKey);
    return null;
  }
}

export function writeSession(token: string, user: User) {
  window.sessionStorage.setItem(storageKey, JSON.stringify({ token, user }));
  window.dispatchEvent(new CustomEvent(sessionUpdatedEvent, { detail: { token, user } }));
}

export function useSession(required = true) {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = readSession();
    if (!saved) {
      setReady(true);
      if (required) router.replace('/login');
      return;
    }
    setToken(saved.token);
    setUser(saved.user);
    api<User>('/auth/me', undefined, saved.token)
      .then((me) => {
        setUser(me);
        writeSession(saved.token, me);
      })
      .catch(() => {
        window.sessionStorage.removeItem(storageKey);
        router.replace('/login');
      })
      .finally(() => setReady(true));
  }, [required, router]);

  useEffect(() => {
    function syncSession(event: Event) {
      const detail = (event as CustomEvent<{ token: string; user: User }>).detail;
      if (detail?.token && detail.user) {
        setToken(detail.token);
        setUser(detail.user);
        return;
      }
      const saved = readSession();
      if (saved) {
        setToken(saved.token);
        setUser(saved.user);
      }
    }

    window.addEventListener(sessionUpdatedEvent, syncSession);
    return () => window.removeEventListener(sessionUpdatedEvent, syncSession);
  }, []);

  useEffect(() => {
    if (!user) return;
    document.documentElement.dataset.theme = user.theme || 'light';
    document.documentElement.dir = user.language === 'en' ? 'ltr' : 'rtl';
    document.documentElement.lang = user.language || 'ar';
  }, [user]);

  function logout() {
    window.sessionStorage.removeItem(storageKey);
    setToken('');
    setUser(null);
    router.replace('/login');
  }

  return { token, user, setUser, ready, logout };
}
