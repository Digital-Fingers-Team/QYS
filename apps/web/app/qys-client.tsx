'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { MonthlyReportRow, MonthlyReportsSummary, Paginated } from '@qys/shared';
import { api, apiForm, ApiClientError, downloadApi } from '../lib/api';
import { field, num, useData, usePaginatedData } from './qys/data';
import { canAccessReports, canManageAccounts, canOpenAdmin, roleLabel, roleOptionsFor } from './qys/permissions';
import { useSession, writeSession } from './qys/session';
import { Header, PaginationControls } from './qys/shared-ui';
import type { Activity, Center, CenterCredentials, CenterMetrics, Challenge, ChatMessage, Complaint, Idea, MonthlyReportUploadResponse, Report, Role, User } from './qys/types';

const roleOptions: Array<{ value: Role; label: string }> = [
  { value: 'USER', label: 'مستخدم' },
  { value: 'CENTER_MANAGER', label: 'مسؤول مركز' },
  { value: 'DIRECTORATE_MANAGER', label: 'مدير مديرية' }
];
const labels = {
  ar: {
    login: 'تسجيل الدخول',
    signup: 'إنشاء حساب',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    name: 'الاسم',
    dashboard: 'الرئيسية',
    centers: 'المراكز',
    map: 'الخريطة',
    ideas: 'الأفكار',
    challenges: 'التحديات',
    complaints: 'الشكاوى',
    settings: 'الإعدادات',
    users: 'المستخدمون',
    reports: 'التقارير',
    chat: 'المحادثات',
    logout: 'تسجيل الخروج',
    save: 'حفظ',
    add: 'إضافة',
    delete: 'حذف',
    status: 'الحالة',
    search: 'بحث'
  },
  en: {
    login: 'Login',
    signup: 'Sign up',
    email: 'Email',
    password: 'Password',
    name: 'Name',
    dashboard: 'Dashboard',
    centers: 'Centers',
    map: 'Map',
    ideas: 'Ideas',
    challenges: 'Challenges',
    complaints: 'Complaints',
    settings: 'Settings',
    users: 'Users',
    reports: 'Reports',
    chat: 'Chat',
    logout: 'Logout',
    save: 'Save',
    add: 'Add',
    delete: 'Delete',
    status: 'Status',
    search: 'Search'
  }
};

function requiredText(form: HTMLFormElement, name: string, min = 2) {
  const value = field(form, name);
  if (value.length < min) throw new Error(`${name} must contain at least ${min} characters.`);
  return value;
}

async function uploadImageFile(file: File, token: string) {
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
    throw new Error('Image must be PNG, JPEG, WebP, or GIF.');
  }
  const data = new FormData();
  data.append('file', file);
  const result = await apiForm<{ url: string }>('/media/images', data, token);
  return result.url;
}

function CenterSelect({ centers, defaultValue = '', required = false }: { centers: Center[]; defaultValue?: number | string | null; required?: boolean }) {
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

const qalyubiaDirectoratePage = 'https://www.facebook.com/102018988020631/';
const authSocialActions: Array<{ label: string; href: string; icon: 'facebook' }> = [
  { label: 'Qalyubia Directorate Facebook', href: qalyubiaDirectoratePage, icon: 'facebook' }
];

function AuthSocialIcon({ icon }: { icon: (typeof authSocialActions)[number]['icon'] }) {
  if (icon === 'facebook') {
    return <span className="auth-social-brand auth-social-facebook" aria-hidden="true">f</span>;
  }
  return null;
}

function AuthSocialActions() {
  return (
    <div className="auth-social-actions" aria-label="Social links">
      {authSocialActions.map((action) => {
        const content = <AuthSocialIcon icon={action.icon} />;
        return (
          <a key={action.label} className="auth-social-button" href={action.href} aria-label={action.label} target="_blank" rel="noreferrer">
            {content}
          </a>
        );
      })}
    </div>
  );
}

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const { items: centers } = usePaginatedData<Center>('/centers', '', 100, '', mode === 'signup');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const form = e.currentTarget;
      if (mode === 'signup') {
        await api('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ name: field(form, 'name'), email: field(form, 'email'), password: field(form, 'password'), centerId: num(form, 'centerId') })
        });
      }
      const result = await api<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: field(form, 'email'), password: field(form, 'password') })
      });
      writeSession(result.token, result.user);
      router.replace(canManageAccounts(result.user.role) ? '/admin' : result.user.role === 'CENTER_MANAGER' ? '/center/reports' : '/dashboard');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={`auth-page ${mode === 'signup' ? 'signup-auth' : 'login-auth'}`}>
      <form className={`auth-card ${mode === 'signup' ? 'signup-card' : 'login-card'}`} onSubmit={submit}>
        <div className={`${mode === 'signup' ? 'signup-logo' : 'login-logo'} auth-logo`}>
          <img src="/logo.png" alt="منصة الشباب والرياضة" />
        </div>
        <div className={mode === 'signup' ? 'signup-header' : 'login-header'}>
          <h2>{mode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}</h2>
          <p>{mode === 'login' ? 'مرحبا بك مجددا في منصة الشباب' : 'انضم إلينا وابدأ رحلتك الرياضية اليوم'}</p>
        </div>
        <div className="auth-fields">
          {mode === 'signup' && <label className="form-group">الاسم الكامل<input className="input form-control" name="name" placeholder="أدخل اسمك الكامل" required /></label>}
          <label className="form-group">البريد الإلكتروني<input className="input form-control" name="email" type="email" placeholder="admin@example.com" defaultValue={mode === 'login' ? 'admin@example.com' : ''} required /></label>
          <label className="form-group">كلمة المرور<input className="input form-control" name="password" type="password" minLength={mode === 'signup' ? 6 : 1} maxLength={128} placeholder={mode === 'signup' ? '6 أحرف على الأقل' : 'كلمة المرور'} required /></label>
          {mode === 'signup' && <CenterSelect centers={centers} required />}
        </div>
        <button className={mode === 'signup' ? 'btn-signup' : 'btn-login'} disabled={loading}>{loading ? 'جاري التحميل...' : mode === 'login' ? 'تسجيل الدخول' : 'إنشاء الحساب'}</button>
        {error && <p className="error">{error}</p>}
        <p className={mode === 'signup' ? 'login-link' : 'signup-link'}>
          {mode === 'login' ? 'ليس لديك حساب؟ ' : 'لديك حساب بالفعل؟ '}
          <Link href={mode === 'login' ? '/signup' : '/login'}>{mode === 'login' ? 'إنشاء حساب جديد' : 'سجل دخولك هنا'}</Link>
        </p>
        <AuthSocialActions />
      </form>
    </main>
  );
}

function NavSvg({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

function navIconFor(href: string) {
  if (href.includes('users')) {
    return <NavSvg><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></NavSvg>;
  }
  if (href.includes('centers')) {
    return <NavSvg><path d="M3 21h18" /><path d="M5 21V7l7-4 7 4v14" /><path d="M9 21v-6h6v6" /><path d="M9 9h.01" /><path d="M12 9h.01" /><path d="M15 9h.01" /><path d="M9 12h.01" /><path d="M12 12h.01" /><path d="M15 12h.01" /></NavSvg>;
  }
  if (href.includes('map')) {
    return <NavSvg><path d="M9 18 3 21V6l6-3 6 3 6-3v15l-6 3-6-3Z" /><path d="M9 3v15" /><path d="M15 6v15" /><path d="M12 10.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" /><path d="M12 10.5v3" /></NavSvg>;
  }
  if (href.includes('ideas')) {
    return <NavSvg><path d="M9 18h6" /><path d="M10 22h4" /><path d="M12 2a7 7 0 0 0-4 12.74V17h8v-2.26A7 7 0 0 0 12 2Z" /></NavSvg>;
  }
  if (href.includes('challenges')) {
    return <NavSvg><path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M5 6H3a4 4 0 0 0 4 4" /><path d="M19 6h2a4 4 0 0 1-4 4" /></NavSvg>;
  }
  if (href.includes('complaints')) {
    return <NavSvg><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /><path d="M12 7v5" /><path d="M12 15h.01" /></NavSvg>;
  }
  if (href.includes('chat')) {
    return <NavSvg><path d="M21 15a4 4 0 0 1-4 4H9l-6 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /><path d="M8 9h8" /><path d="M8 13h5" /></NavSvg>;
  }
  if (href.includes('reports')) {
    return <NavSvg><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M8 17v-3" /><path d="M12 17v-6" /><path d="M16 17v-4" /></NavSvg>;
  }
  if (href.includes('settings')) {
    return <NavSvg><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21a2 2 0 0 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 0 1 4 0v.09A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 0 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z" /></NavSvg>;
  }
  return <NavSvg><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></NavSvg>;
}

function statIconFor(title: string) {
  if (title.includes('مستخدم')) return <NavSvg><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy="7" r="4" /><path d="M19 8v6" /><path d="M22 11h-6" /></NavSvg>;
  if (title.includes('مركز') || title.includes('المراكز')) return <NavSvg><path d="M3 21h18" /><path d="M5 21V7l7-4 7 4v14" /><path d="M9 21v-6h6v6" /></NavSvg>;
  if (title.includes('فكر')) return <NavSvg><path d="M9 18h6" /><path d="M10 22h4" /><path d="M12 2a7 7 0 0 0-4 12.74V17h8v-2.26A7 7 0 0 0 12 2Z" /></NavSvg>;
  if (title.includes('تحد')) return <NavSvg><path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M5 6H3a4 4 0 0 0 4 4" /><path d="M19 6h2a4 4 0 0 1-4 4" /></NavSvg>;
  if (title.includes('شك') || title.includes('طلب')) return <NavSvg><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /><path d="M12 7v5" /><path d="M12 15h.01" /></NavSvg>;
  if (title.includes('تصويت')) return <NavSvg><path d="M9 12l2 2 4-5" /><path d="M21 12a9 9 0 1 1-9-9" /><path d="M17 3h4v4" /></NavSvg>;
  if (title.includes('إيراد')) return <NavSvg><path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" /></NavSvg>;
  if (title.includes('مصروف')) return <NavSvg><path d="M3 7l6 6 4-4 8 8" /><path d="M14 17h7v-7" /></NavSvg>;
  if (title.includes('ندوات')) return <NavSvg><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15Z" /><path d="M8 7h8" /><path d="M8 11h8" /></NavSvg>;
  return navIconFor('/admin');
}

function userInitial(user: User) {
  return (user.name || user.email || 'Q').trim().charAt(0).toUpperCase();
}

function roleDescription(role: Role) {
  if (role === 'DIRECTORATE_MANAGER') return 'مسؤول المديرية';
  if (role === 'CENTER_MANAGER') return 'مسؤول مركز';
  return 'عضو المنصة';
}

function hasUserPoints(role?: Role) {
  return role === 'USER';
}

function Shell({ children, admin = false }: { children: React.ReactNode; admin?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, ready } = useSession(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const t = labels[user?.language || 'ar'];
  const nav = admin
    ? [
        ['/admin', t.dashboard],
        ['/admin/users', t.users],
        ['/admin/centers', t.centers],
        ['/admin/map', t.map],
        ['/admin/ideas', t.ideas],
        ['/admin/challenges', t.challenges],
        ['/admin/complaints', t.complaints],
        ['/admin/reports', t.reports],
        ['/admin/chat', t.chat],
        ['/admin/settings', t.settings]
      ]
    : user?.role === 'CENTER_MANAGER'
      ? [
        ['/center', t.dashboard],
        ['/center/reports', t.reports],
        ['/center/map', t.map],
        ['/center/ideas', t.ideas],
        ['/center/users', t.users],
        ['/center/challenges', t.challenges],
        ['/center/complaints', t.complaints],
        ['/center/chat', t.chat],
        ['/center/settings', t.settings]
      ]
      : [
        ['/dashboard', t.dashboard],
        ['/centers', t.centers],
        ['/map', t.map],
        ['/ideas', t.ideas],
        ['/challenges', t.challenges],
        ['/complaints', t.complaints],
        ['/settings', t.settings]
      ];

  useEffect(() => {
    if (!ready || !user) return;
    if (admin && !canOpenAdmin(user.role)) router.replace('/dashboard');
  }, [admin, ready, router, user]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const settingsHref = admin ? '/admin/settings' : user?.role === 'CENTER_MANAGER' ? '/center/settings' : '/settings';

  if (!ready || !user) return <main className="auth-page">جاري التحميل...</main>;

  return (
    <div className="app-container">
      <div className={`overlay ${mobileOpen ? 'active' : ''}`} onClick={() => setMobileOpen(false)} />
      <aside className={`sidebar ${mobileOpen ? 'active' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <img src="/logo.png" alt="منصة الشباب والرياضة" />
          </div>
          <h3>{admin ? 'مديرية الشباب والرياضة' : 'منصة الشباب والرياضة'}</h3>
          <p>{admin ? 'لوحة تحكم المسؤول' : 'القليوبية | منصتك الذكية'}</p>
        </div>
        <nav className="sidebar-nav">
          {nav.map(([href, text]) => (
            <Link key={href} className={`nav-link ${pathname === href ? 'active' : ''}`} href={href}>
              <span className="nav-icon" aria-hidden>{navIconFor(href)}</span>
              <span>{text}</span>
            </Link>
          ))}
          {canOpenAdmin(user.role) && !admin && <Link className="nav-link" href="/admin"><span className="nav-icon" aria-hidden>{navIconFor('/admin')}</span><span>لوحة الإدارة</span></Link>}
        </nav>
      </aside>
      <main className="main-content">
        <header className="top-header">
          <div className="header-left">
            <button className="btn btn-outline menu-toggle" type="button" onClick={() => setMobileOpen((open) => !open)} aria-label="فتح القائمة">
              <span aria-hidden>☰</span>
            </button>
          </div>
          <div className="header-right">
            <a className="dashboard-facebook-link" href={qalyubiaDirectoratePage} target="_blank" rel="noreferrer" aria-label="Qalyubia Directorate Facebook">
              <span className="auth-social-brand auth-social-facebook" aria-hidden="true">f</span>
            </a>
            {hasUserPoints(user.role) && <div className="points-badge"><span>{user.points || 0}</span><span>نقطة</span></div>}
            <Link className="user-profile-header" href={settingsHref} title={t.settings}>
              <span className="user-avatar">{user.avatar ? <img src={user.avatar} alt="" /> : userInitial(user)}</span>
              <span className="user-info-text">
                <strong>{user.name}</strong>
                <span>{roleDescription(user.role)} | {t.settings}</span>
              </span>
            </Link>
          </div>
        </header>
        <div className="content-wrapper">{children}</div>
      </main>
    </div>
  );
}

export function UserPage({ section }: { section: 'dashboard' | 'centers' | 'map' | 'ideas' | 'challenges' | 'complaints' | 'reports' | 'settings' }) {
  const { token, user, setUser, logout } = useSession(true);
  return (
    <Shell>
      {section === 'dashboard' && <UserDashboard token={token} />}
      {section === 'centers' && <CentersPage token={token} admin={false} />}
      {section === 'map' && <CentersMapPage token={token} />}
      {section === 'ideas' && <IdeasPage token={token} admin={false} />}
      {section === 'challenges' && <ChallengesPage token={token} admin={false} />}
      {section === 'complaints' && <ComplaintsPage token={token} admin={false} />}
      {section === 'reports' && user && canAccessReports(user.role) && <ReportsAdmin token={token} currentUser={user} />}
      {section === 'reports' && user && !canAccessReports(user.role) && <Header title="غير مصرح" subtitle="لا تملك صلاحية فتح هذه الصفحة." />}
      {section === 'settings' && user && <SettingsPage token={token} user={user} setUser={setUser} logout={logout} />}
    </Shell>
  );
}

export function CenterPage({ section }: { section: 'dashboard' | 'reports' | 'map' | 'ideas' | 'users' | 'challenges' | 'complaints' | 'chat' | 'settings' }) {
  const router = useRouter();
  const { token, user, setUser, ready, logout } = useSession(true);

  useEffect(() => {
    if (ready && user?.role !== 'CENTER_MANAGER') router.replace('/dashboard');
  }, [ready, router, user]);

  if (!ready || !user) return <main className="auth-page">جاري التحميل...</main>;

  return (
    <Shell>
      {user.role !== 'CENTER_MANAGER' && <Header title="غير مصرح" subtitle="لا تملك صلاحية فتح هذه الصفحة." />}
      {user.role === 'CENTER_MANAGER' && section === 'dashboard' && <CenterManagerDashboard token={token} />}
      {user.role === 'CENTER_MANAGER' && section === 'reports' && <ReportsAdmin token={token} currentUser={user} />}
      {user.role === 'CENTER_MANAGER' && section === 'map' && <CentersMapPage token={token} />}
      {user.role === 'CENTER_MANAGER' && section === 'ideas' && <IdeasPage token={token} admin={false} centerApproval />}
      {user.role === 'CENTER_MANAGER' && section === 'users' && <CenterUsersPage token={token} />}
      {user.role === 'CENTER_MANAGER' && section === 'challenges' && <ChallengesPage token={token} admin={false} />}
      {user.role === 'CENTER_MANAGER' && section === 'complaints' && <ComplaintsPage token={token} admin={false} centerApproval />}
      {user.role === 'CENTER_MANAGER' && section === 'chat' && <ChatPage token={token} currentUser={user} admin={false} />}
      {user.role === 'CENTER_MANAGER' && section === 'settings' && <SettingsPage token={token} user={user} setUser={setUser} logout={logout} />}
    </Shell>
  );
}

function UserDashboard({ token }: { token: string }) {
  const { data } = useData<any>('/stats/me', token);
  const { items: complaints } = usePaginatedData<Complaint>('/complaints', token, 10);
  const suggestedChallenges = data?.suggestedChallenges || [];
  const recentIdeas = data?.recentIdeas || [];
  const openComplaints = complaints.filter((complaint) => !['RESOLVED', 'REJECTED'].includes(complaint.status)).length;
  const alerts: AlertItem[] = [
    openComplaints > 0 ? { title: 'طلبات تحتاج متابعة', detail: `${openComplaints} شكوى أو مقترح ما زال قيد المعالجة.`, tone: 'warning', href: '/complaints' } : undefined,
    suggestedChallenges.length > 0 ? { title: 'تحديات متاحة', detail: `${suggestedChallenges.length} تحديات مناسبة يمكنك الانضمام إليها الآن.`, tone: 'success', href: '/challenges' } : undefined,
    recentIdeas.length === 0 ? { title: 'ابدأ بفكرة تطوير', detail: 'شارك فكرة جديدة لتطوير مركزك أو الخدمات الرياضية.', tone: 'info', href: '/ideas' } : undefined
  ].filter(Boolean) as AlertItem[];
  return (
    <>
      <Header title="أهلا بك في منصتك الرياضية" subtitle="تابع نشاطك، تنبيهاتك، والتحديات المتاحة لك." />
      <div className="grid stats">
        <Stat title="أفكاري" value={data?.ideas || 0} />
        <Stat title="تحدياتي" value={data?.joinedChallenges || 0} />
        <Stat title="طلباتي المفتوحة" value={openComplaints} />
      </div>
      <div className="dashboard-grid" style={{ marginTop: 16 }}>
        <AlertPanel title="تنبيهات اليوم" alerts={alerts} />
        <NotificationsPanel items={[
          { title: 'آخر الأفكار', detail: recentIdeas.length ? 'لديك أفكار منشورة أو تحت المتابعة.' : 'لم يتم تسجيل أفكار حديثة بعد.', tone: recentIdeas.length ? 'success' : 'info', href: '/ideas' },
          { title: 'التحديات', detail: suggestedChallenges.length ? 'توجد تحديات جديدة بانتظار مشاركتك.' : 'لا توجد تحديات جديدة حاليا.', tone: suggestedChallenges.length ? 'warning' : 'success', href: '/challenges' }
        ]} />
      </div>
      <div className="grid cards" style={{ marginTop: 16 }}>
        {suggestedChallenges.map((challenge: Challenge) => <ChallengeCard key={challenge.id} challenge={challenge} token={token} onDone={() => location.reload()} />)}
        {recentIdeas.map((idea: Idea) => <IdeaCard key={idea.id} idea={idea} token={token} />)}
        {suggestedChallenges.length === 0 && recentIdeas.length === 0 && <EmptyState title="لا توجد عناصر جديدة حالياً" detail="ستظهر هنا التحديات والأفكار عند توفرها." />}
      </div>
    </>
  );
}

function CenterManagerDashboard({ token }: { token: string }) {
  const month = currentMonthValue();
  const { data: summary } = useData<MonthlyReportsSummary>(`/monthly-reports/summary?month=${month}`, token, null);
  const { items: reports } = usePaginatedData<MonthlyReportRow>(`/monthly-reports?month=${month}`, token, 5);
  const { items: complaints } = usePaginatedData<Complaint>('/complaints', token, 10);
  const pendingComplaints = complaints.filter((complaint) => complaint.centerReviewStatus === 'PENDING' || complaint.status === 'PENDING').length;
  const hasMonthlyReport = reports.some((report) => report.month === month);
  const alerts: AlertItem[] = [
    !hasMonthlyReport ? { title: 'تقرير الشهر غير مرفوع', detail: `ارفع تقرير ${formatMonthArabic(month)} قبل نهاية الشهر.`, tone: 'danger', href: '/center/reports' } : { title: 'تقرير الشهر مرفوع', detail: 'تم تسجيل تقرير هذا الشهر بنجاح.', tone: 'success', href: '/center/reports' },
    pendingComplaints > 0 ? { title: 'شكاوى قيد المراجعة', detail: `${pendingComplaints} طلب يحتاج مراجعة أو تحديث حالة.`, tone: 'warning', href: '/center/complaints' } : undefined,
    summary?.latestUploads?.some((upload) => upload.status === 'REJECTED') ? { title: 'ملفات مرفوضة', detail: 'راجع آخر ملفات Excel المرفوضة وأعد رفعها.', tone: 'danger', href: '/center/reports' } : undefined
  ].filter(Boolean) as AlertItem[];

  return (
    <>
      <Header title="لوحة مركزك" subtitle="ملخص سريع للتقارير، الشكاوى، والتنبيهات الخاصة بالمركز." />
      <div className="grid stats">
        <Stat title="تقارير الشهر" value={reports.length} />
        <Stat title="طلبات قيد المتابعة" value={pendingComplaints} />
        <Stat title="إيرادات الشهر" value={formatMoney(summary?.totalRevenues || 0)} />
      </div>
      <div className="dashboard-grid" style={{ marginTop: 16 }}>
        <AlertPanel title="تنبيهات تشغيلية" alerts={alerts} />
        <NotificationsPanel items={(summary?.latestUploads || []).slice(0, 4).map((upload) => ({
          title: upload.status === 'REJECTED' ? 'ملف مرفوض' : upload.status === 'ACCEPTED' ? 'ملف مقبول' : 'تحديث ملف',
          detail: `${upload.originalName} - ${formatMonthArabic(upload.month)}`,
          tone: upload.status === 'REJECTED' ? 'danger' : upload.status === 'ACCEPTED' ? 'success' : 'info',
          href: '/center/reports'
        }))} />
      </div>
      <div className="dashboard-grid" style={{ marginTop: 16 }}>
        <MiniBarChart title="أداء الشهر" items={[
          { label: 'الإيرادات', value: summary?.totalRevenues || 0, tone: 'success' },
          { label: 'المصروفات', value: summary?.totalExpenses || 0, tone: 'warning' },
          { label: 'المراكز المرفوعة', value: summary?.uploadedCenters || 0, tone: 'info' }
        ]} valueLabel={(value) => formatMoney(value)} />
        <section className="panel">
          <h3>مسار تقرير الشهر</h3>
          <AuditTimeline items={[
            { title: 'اختيار الشهر', detail: formatMonthArabic(month), tone: 'info' },
            { title: hasMonthlyReport ? 'تم الرفع' : 'بانتظار الرفع', detail: hasMonthlyReport ? 'التقرير موجود في النظام.' : 'ارفع ملف Excel من صفحة التقارير.', tone: hasMonthlyReport ? 'success' : 'warning' },
            { title: 'مراجعة المديرية', detail: 'تابع أي ملاحظات أو رسائل من صفحة المحادثات.', tone: 'info' }
          ]} />
        </section>
      </div>
    </>
  );
}

function Stat({ title, value }: { title: string; value: number | string }) {
  return (
    <div className="card stat-card">
      <div className="stat-icon" aria-hidden>{statIconFor(title)}</div>
      <div className="stat-info">
        <h3>{value}</h3>
        <p>{title}</p>
      </div>
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      {detail && <span>{detail}</span>}
    </div>
  );
}

type AlertTone = 'info' | 'warning' | 'danger' | 'success';
type AlertItem = { title: string; detail: string; tone?: AlertTone; href?: string };
type TimelineItem = { title: string; detail?: string; tone?: AlertTone };

function AlertPanel({ title, alerts }: { title: string; alerts: AlertItem[] }) {
  return (
    <section className="panel insight-panel">
      <h3>{title}</h3>
      <div className="insight-list">
        {alerts.map((alert, index) => {
          const content = (
            <>
              <span className={`insight-dot ${alert.tone || 'info'}`} aria-hidden />
              <span>
                <strong>{alert.title}</strong>
                <small>{alert.detail}</small>
              </span>
            </>
          );
          return alert.href ? (
            <Link key={`${alert.title}-${index}`} className="insight-row" href={alert.href}>{content}</Link>
          ) : (
            <div key={`${alert.title}-${index}`} className="insight-row">{content}</div>
          );
        })}
        {alerts.length === 0 && <EmptyState title="لا توجد تنبيهات عاجلة" detail="كل المؤشرات الحالية مستقرة." />}
      </div>
    </section>
  );
}

function NotificationsPanel({ items }: { items: AlertItem[] }) {
  return <AlertPanel title="الإشعارات" alerts={items} />;
}

function AuditTimeline({ items }: { items: TimelineItem[] }) {
  return (
    <div className="audit-timeline">
      {items.map((item, index) => (
        <div className="audit-step" key={`${item.title}-${index}`}>
          <span className={`audit-marker ${item.tone || 'info'}`} aria-hidden />
          <div>
            <strong>{item.title}</strong>
            {item.detail && <small>{item.detail}</small>}
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniBarChart({ title, items, valueLabel }: { title: string; items: Array<{ label: string; value: number; tone?: AlertTone }>; valueLabel?: (value: number) => string }) {
  const hasValues = items.some((item) => item.value > 0);
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <section className="panel analytics-card">
      <h3>{title}</h3>
      <div className="analytics-bars">
        {!hasValues && <EmptyState title="لا توجد بيانات مسجلة" detail="سيظهر الرسم هنا بعد تسجيل قيم فعلية لهذا المؤشر." />}
        {hasValues && items.map((item) => (
          <div className="analytics-bar-row" key={item.label}>
            <span>{item.label}</span>
            <div className="analytics-bar-track">
              <i className={item.tone || 'info'} style={{ width: item.value > 0 ? `${Math.max(4, (item.value / max) * 100)}%` : '0%' }} />
            </div>
            <strong>{valueLabel ? valueLabel(item.value) : item.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function CentersPage({ token, admin }: { token: string; admin: boolean }) {
  const [selectedCenter, setSelectedCenter] = useState<Center | null>(null);
  const { items: centers, page, totalPages, setPage } = usePaginatedData<Center>('/centers', token, 24);
  const { data: centerMetrics } = useData<CenterMetrics[]>('/centers/metrics', token, [], admin);
  const metricsByCenter = useMemo(
    () => new Map((centerMetrics || []).map((item) => [item.centerId, item])),
    [centerMetrics]
  );

  return (
    <>
      <Header title={admin ? 'إدارة المراكز' : 'المراكز الشبابية والرياضية'} subtitle="استكشف مراكز الشباب في محافظة القليوبية." />
      <div className="panel centers-directory" style={{ marginTop: 16 }}>
        <div className="centers-directory-list">
          {centers.map((center) => <CenterDirectoryRow key={center.id} center={center} admin={admin} metrics={metricsByCenter.get(center.id)} onSelect={() => setSelectedCenter(center)} />)}
          {centers.length === 0 && <EmptyState title="لا توجد مراكز للعرض" detail="عند إضافة المراكز ستظهر في هذا الدليل." />}
        </div>
      </div>
      <PaginationControls page={page} totalPages={totalPages} setPage={setPage} />
      {selectedCenter && <CenterDetailsModal center={selectedCenter} admin={admin} token={token} metrics={metricsByCenter.get(selectedCenter.id)} onClose={() => setSelectedCenter(null)} />}
    </>
  );
}

type CenterAreaGroup = {
  name: string;
  centers: Center[];
  lat: number;
  lng: number;
};

type CenterMapPoint = {
  center: Center;
  groupName: string;
  lat: number;
  lng: number;
};

const qalyubiaMapCenter: [number, number] = [30.3304, 31.2168];

const centerAreaCoordinates = [
  { key: 'شبين القناطر', lat: 30.3122, lng: 31.3208 },
  { key: 'القناطر', lat: 30.1939, lng: 31.1369 },
  { key: 'كفر شكر', lat: 30.5536, lng: 31.2646 },
  { key: 'بنها', lat: 30.4668, lng: 31.1848 },
  { key: 'طوخ', lat: 30.3539, lng: 31.2016 },
  { key: 'القليوبية', lat: 30.3304, lng: 31.2168 },
  { key: 'قليوب', lat: 30.1792, lng: 31.2056 },
  { key: 'شبرا', lat: 30.1286, lng: 31.2422 },
  { key: 'الخانكة', lat: 30.2098, lng: 31.3681 },
  { key: 'قها', lat: 30.2817, lng: 31.2052 },
  { key: 'الخصوص', lat: 30.1558, lng: 31.3144 },
  { key: 'العبور', lat: 30.2288, lng: 31.4811 }
];

function centerAreaCoordinate(location: string, index: number, total: number) {
  const known = centerAreaCoordinates.find((coordinate) => location.includes(coordinate.key));
  if (known) return { lat: known.lat, lng: known.lng };
  const angle = (index / Math.max(1, total)) * Math.PI * 2 - Math.PI / 2;
  return {
    lat: qalyubiaMapCenter[0] + Math.sin(angle) * 0.18,
    lng: qalyubiaMapCenter[1] + Math.cos(angle) * 0.24
  };
}

function groupCentersForMap(centers: Center[]): CenterAreaGroup[] {
  const byLocation = new Map<string, Center[]>();
  centers.forEach((center) => {
    const location = center.location.trim() || 'غير محدد';
    byLocation.set(location, [...(byLocation.get(location) || []), center]);
  });
  const entries = [...byLocation.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'ar'));
  return entries.map(([name, areaCenters], index) => ({
    name,
    centers: [...areaCenters].sort((a, b) => a.name.localeCompare(b.name, 'ar')),
    ...centerAreaCoordinate(name, index, entries.length)
  }));
}

function centerMapPoints(groups: CenterAreaGroup[]): CenterMapPoint[] {
  return groups.flatMap((group) => {
    const radius = Math.min(0.035, Math.max(0.006, group.centers.length * 0.0011));
    return group.centers.map((center, index) => {
      const angle = index * 2.399963229728653;
      const distance = radius * Math.sqrt((index + 1) / Math.max(1, group.centers.length));
      return {
        center,
        groupName: group.name,
        lat: group.lat + Math.sin(angle) * distance,
        lng: group.lng + Math.cos(angle) * distance
      };
    });
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function loadAllCenters(token: string) {
  const first = await api<Paginated<Center>>('/centers?page=1&pageSize=100', undefined, token);
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, first.totalPages - 1) }, (_, index) =>
      api<Paginated<Center>>(`/centers?page=${index + 2}&pageSize=100`, undefined, token)
    )
  );
  return [first, ...rest].flatMap((page) => page.items);
}

function CentersMapPage({ token }: { token: string }) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<import('leaflet').Map | null>(null);
  const markerLayerRef = useRef<import('leaflet').LayerGroup | null>(null);
  const [centers, setCenters] = useState<Center[]>([]);
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedCenter, setSelectedCenter] = useState<Center | null>(null);
  const [mapQuery, setMapQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const filteredCenters = useMemo(() => {
    const query = mapQuery.trim().toLowerCase();
    if (!query) return centers;
    return centers.filter((center) => `${center.name} ${center.location} ${center.type}`.toLowerCase().includes(query));
  }, [centers, mapQuery]);
  const areaGroups = useMemo(() => groupCentersForMap(filteredCenters), [filteredCenters]);
  const mapPoints = useMemo(() => centerMapPoints(areaGroups), [areaGroups]);
  const selectedGroup = areaGroups.find((group) => group.name === selectedArea) || areaGroups[0];

  useEffect(() => {
    let cancelled = false;
    import('leaflet').then((L) => {
      if (cancelled || !mapElementRef.current || leafletMapRef.current) return;
      const map = L.map(mapElementRef.current, {
        center: qalyubiaMapCenter,
        zoom: 10,
        minZoom: 9,
        maxZoom: 18,
        scrollWheelZoom: true
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);
      const markerLayer = L.layerGroup().addTo(map);
      leafletMapRef.current = map;
      markerLayerRef.current = markerLayer;
      window.setTimeout(() => map.invalidateSize(), 0);
    });
    return () => {
      cancelled = true;
      markerLayerRef.current?.remove();
      leafletMapRef.current?.remove();
      markerLayerRef.current = null;
      leafletMapRef.current = null;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    loadAllCenters(token)
      .then((items) => {
        if (active) setCenters(items);
      })
      .catch((err) => {
        if (active) setError((err as Error).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!areaGroups.length) {
      setSelectedArea('');
      return;
    }
    if (!selectedArea || !areaGroups.some((group) => group.name === selectedArea)) {
      setSelectedArea(areaGroups[0].name);
    }
  }, [areaGroups, selectedArea]);

  useEffect(() => {
    let active = true;
    import('leaflet').then((L) => {
      if (!active || !leafletMapRef.current || !markerLayerRef.current) return;
      markerLayerRef.current.clearLayers();
      const bounds: Array<[number, number]> = [];
      mapPoints.forEach((point) => {
        const marker = L.marker([point.lat, point.lng], {
          icon: L.divIcon({
            className: 'gps-marker-shell',
            html: '<span class="gps-marker-dot"></span>',
            iconSize: [22, 22],
            iconAnchor: [11, 11]
          }),
          title: point.center.name
        });
        marker.bindPopup(
          `<div class="gps-popup" dir="rtl"><strong>${escapeHtml(point.center.name)}</strong><span>${escapeHtml(point.center.location)}</span></div>`
        );
        marker.on('click', () => {
          setSelectedArea(point.groupName);
          setSelectedCenter(point.center);
        });
        marker.addTo(markerLayerRef.current!);
        bounds.push([point.lat, point.lng]);
      });
      if (bounds.length) {
        leafletMapRef.current.fitBounds(L.latLngBounds(bounds), { padding: [28, 28], maxZoom: 11 });
      }
    });
    return () => {
      active = false;
    };
  }, [mapPoints]);

  useEffect(() => {
    if (!selectedGroup || !leafletMapRef.current) return;
    leafletMapRef.current.setView([selectedGroup.lat, selectedGroup.lng], Math.max(12, leafletMapRef.current.getZoom()), { animate: true });
  }, [selectedGroup?.name]);

  return (
    <>
      <Header title="خريطة المراكز" subtitle="عرض مراكز الشباب حسب مناطق محافظة القليوبية." />
      {error && <p className="error">{error}</p>}
      <div className="centers-map-layout">
        <section className="panel centers-map-panel">
          <div className="centers-map-canvas" aria-label="خريطة مراكز الشباب في القليوبية" dir="ltr" ref={mapElementRef}>
            <div className="map-centers-counter" dir="rtl">
              <span>{loading ? '...' : centers.length}</span>
              <strong>عدد المراكز</strong>
            </div>
            {loading && <div className="map-loading">جاري تحميل المراكز...</div>}
          </div>
        </section>
        <aside className="panel map-directory">
          <div className="map-directory-header">
            <div>
              <h3>{selectedGroup?.name || 'المناطق'}</h3>
              <p className="muted">{selectedGroup ? `${selectedGroup.centers.length} مركز` : 'لا توجد بيانات'} | المعروض {filteredCenters.length} من {centers.length}</p>
            </div>
            <span className="badge">{areaGroups.length}</span>
          </div>
          <input className="input map-search" type="search" value={mapQuery} onChange={(event) => setMapQuery(event.target.value)} placeholder="ابحث باسم المركز أو المنطقة" />
          <div className="map-area-list">
            {areaGroups.map((group) => (
              <button key={group.name} className={selectedGroup?.name === group.name ? 'active' : ''} type="button" onClick={() => setSelectedArea(group.name)}>
                <span>{group.name}</span>
                <strong>{group.centers.length}</strong>
              </button>
            ))}
          </div>
          <div className="map-centers-list">
            {(selectedGroup?.centers || []).map((center) => (
              <article key={center.id} className={`map-center-row ${selectedCenter?.id === center.id ? 'active' : ''}`} role="button" tabIndex={0} onClick={() => setSelectedCenter(center)} onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setSelectedCenter(center);
                }
              }}>
                <div>
                  <h4>{center.name}</h4>
                  <p className="muted">{center.type}</p>
                </div>
                <span>{center.rating || '-'}</span>
              </article>
            ))}
          </div>
          {selectedCenter && <div className="map-selected-center">
            <strong>{selectedCenter.name}</strong>
            <span>{selectedCenter.location}</span>
            <p>{selectedCenter.description}</p>
          </div>}
        </aside>
      </div>
    </>
  );
}

function LocationPin() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function CenterDirectoryRow({ center, admin, metrics, onSelect }: { center: Center; admin: boolean; metrics?: CenterMetrics; onSelect: () => void }) {
  return (
    <article
      className="center-directory-row"
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="center-directory-info">
        <div className="center-directory-image">
          {center.image ? <img src={center.image} alt="" /> : <span>{center.name.trim().charAt(0)}</span>}
        </div>
        <div className="center-directory-copy">
          <h3>{center.name}</h3>
          <p><span className="center-location-icon"><LocationPin /></span>{center.location}</p>
          {admin && <div className="center-directory-metrics">
            <span className="center-directory-metric">
              <strong>{metrics?.eventsCount ?? 0}</strong>
              <span>الفعاليات</span>
            </span>
            <span className="center-directory-metric">
              <strong>{metrics?.usersCount ?? 0}</strong>
              <span>المستخدمون</span>
            </span>
          </div>}
        </div>
      </div>
      {!admin && <div className="center-login-card">
        <div className="center-login-line">
          <span>النوع:</span>
          <strong>{center.type}</strong>
        </div>
        <div className="center-login-line">
          <span>التقييم:</span>
          <strong>{center.rating || '-'}</strong>
        </div>
      </div>}
    </article>
  );
}

function CenterCredentialReveal({ center, token }: { center: Center; token: string }) {
  const [credentials, setCredentials] = useState<CenterCredentials | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function reveal(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setMessage('');
    setLoading(true);
    try {
      const result = await api<CenterCredentials>(`/centers/${center.id}/credentials/reveal`, {
        method: 'POST',
        body: JSON.stringify({ password: field(form, 'password') })
      }, token);
      setCredentials(result);
      form.reset();
    } catch (err) {
      setCredentials(null);
      setMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="center-credential-panel">
      <div className="center-credential-header">
        <div>
          <span>بيانات دخول المركز</span>
          <strong>{credentials ? 'تم التحقق' : 'محمية بكلمة مرور المدير'}</strong>
        </div>
      </div>
      {credentials ? (
        <div className="center-credential-results">
          <div className="center-login-line">
            <span>بريد المدير</span>
            <strong className="center-login-email">{credentials.email}</strong>
          </div>
          <div className="center-login-line">
            <span>كلمة المرور</span>
            <strong className="center-login-password">{credentials.password}</strong>
          </div>
          <button className="btn" type="button" onClick={() => setCredentials(null)}>إخفاء كلمة المرور</button>
        </div>
      ) : (
        <form className="center-credential-form" onSubmit={reveal}>
          <input className="input" name="password" type="password" maxLength={128} placeholder="اكتب كلمة مرور حسابك" required />
          <button className="btn primary" disabled={loading}>{loading ? 'جاري التحقق...' : 'إظهار كلمة المرور'}</button>
        </form>
      )}
      {message && <p className="error">{message}</p>}
    </div>
  );
}

function CenterDetailsModal({ center, admin, token, metrics, onClose }: { center: Center; admin: boolean; token: string; metrics?: CenterMetrics; onClose: () => void }) {

  return (
    <div className="center-detail-backdrop" role="presentation" onClick={onClose}>
      <section className="center-detail-modal" role="dialog" aria-modal="true" aria-labelledby="center-detail-title" onClick={(event) => event.stopPropagation()}>
        <button className="center-detail-close" type="button" onClick={onClose} aria-label="إغلاق">×</button>
        <div className="center-detail-hero">
          <div className="center-detail-image">
            {center.image ? <img src={center.image} alt="" /> : <span>{center.name.trim().charAt(0)}</span>}
          </div>
          <div>
            <h2 id="center-detail-title">{center.name}</h2>
            <p><span className="center-location-icon"><LocationPin /></span>{center.location}</p>
          </div>
        </div>
        <div className="center-detail-grid">
          <div>
            <span>النوع</span>
            <strong>{center.type}</strong>
          </div>
          <div>
            <span>التقييم</span>
            <strong>{center.rating || '-'}</strong>
          </div>
          <div>
            <span>المستخدمون</span>
            <strong>{metrics?.usersCount ?? 0}</strong>
          </div>
          <div>
            <span>الفعاليات والتقارير</span>
            <strong>{metrics?.eventsCount ?? 0}</strong>
          </div>
        </div>
        <div className="center-profile-grid">
          <div className="center-profile-block">
            <span>ملخص تشغيلي</span>
            <p>يعرض هذا الملف بيانات المركز، النشاط المرتبط به، ومؤشرات المتابعة التي تساعد المديرية على تقييم الأداء بسرعة.</p>
          </div>
          <div className="center-profile-block">
            <span>مسار المتابعة</span>
            <AuditTimeline items={[
              { title: 'تسجيل المركز', detail: center.createdAt ? new Date(center.createdAt).toLocaleDateString('ar-EG') : 'موجود في قاعدة البيانات', tone: 'info' },
              { title: metrics?.eventsCount ? 'نشاط مسجل' : 'بانتظار النشاط', detail: `${metrics?.eventsCount ?? 0} تقرير أو فعالية`, tone: metrics?.eventsCount ? 'success' : 'warning' },
              { title: metrics?.usersCount ? 'حسابات مرتبطة' : 'لا توجد حسابات مستخدمين', detail: `${metrics?.usersCount ?? 0} مستخدم`, tone: metrics?.usersCount ? 'success' : 'info' }
            ]} />
          </div>
        </div>
        {admin && <CenterCredentialReveal center={center} token={token} />}
        {admin && <div className="inline-actions center-profile-actions">
          <Link className="btn primary" href={`/admin/chat?centerId=${center.id}`}>فتح محادثة المركز</Link>
          <Link className="btn" href="/admin/reports">مراجعة التقارير</Link>
        </div>}
        <div className="center-detail-description">
          <span>الوصف</span>
          <p>{center.description}</p>
        </div>
      </section>
    </div>
  );
}

function ideaStatusLabel(status: string) {
  if (status === 'PENDING') return 'قيد مراجعة المركز';
  if (status === 'ACTIVE') return 'منشورة';
  if (status === 'RESOLVED') return 'تمت المعالجة';
  if (status === 'REJECTED') return 'مرفوضة';
  return status;
}

function isPublishedIdea(status: string) {
  return status === 'ACTIVE' || status === 'RESOLVED';
}

function IdeasPage({ token, admin, viewOnly = false, centerApproval = false }: { token: string; admin: boolean; viewOnly?: boolean; centerApproval?: boolean }) {
  const { items: ideas, load, page, totalPages, setPage } = usePaginatedData<Idea>('/ideas', token, 20);
  const [message, setMessage] = useState('');
  const readOnly = admin || viewOnly || centerApproval;
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setMessage('');
    try {
      await api('/ideas', { method: 'POST', body: JSON.stringify({ title: requiredText(form, 'title'), description: requiredText(form, 'description') }) }, token);
      form.reset();
      setMessage('تم إرسال الفكرة إلى المركز لمراجعتها قبل النشر.');
      load();
    } catch (err) {
      setMessage((err as Error).message);
    }
  }
  return (
    <>
      <Header title={admin ? 'إدارة بنك الأفكار' : 'بنك الأفكار التطويرية'} subtitle="شارك واقرأ أفكار تطوير مراكز الشباب." />
      {!readOnly && <form className="panel grid" onSubmit={create}>
        <input className="input" name="title" placeholder="عنوان الفكرة" required />
        <textarea className="textarea" name="description" placeholder="وصف الفكرة" required />
        <button className="btn primary">إرسال للمراجعة</button>
      </form>}
      {message && <p className={message.startsWith('تم ') ? 'muted' : 'error'}>{message}</p>}
      <div className="grid cards" style={{ marginTop: 16 }}>
        {ideas.map((idea) => <IdeaCard key={idea.id} idea={idea} token={token} readOnly={readOnly} admin={admin} centerApproval={centerApproval} onDone={load} />)}
        {ideas.length === 0 && <EmptyState title="لا توجد أفكار للعرض" detail={readOnly ? 'ستظهر الأفكار بعد إرسالها أو اعتمادها.' : 'ابدأ بإرسال فكرة جديدة للمراجعة.'} />}
      </div>
      <PaginationControls page={page} totalPages={totalPages} setPage={setPage} />
    </>
  );
}

function IdeaCard({ idea, token, readOnly, admin, centerApproval, onDone }: { idea: Idea; token: string; readOnly?: boolean; admin?: boolean; centerApproval?: boolean; onDone?: () => void }) {
  const [voteCount, setVoteCount] = useState(idea.votes);
  const [hasVoted, setHasVoted] = useState(Boolean(idea.voted));
  const [voteMessage, setVoteMessage] = useState('');
  const [isVoting, setIsVoting] = useState(false);

  useEffect(() => {
    setVoteCount(idea.votes);
    setHasVoted(Boolean(idea.voted));
    setVoteMessage('');
    setIsVoting(false);
  }, [idea.id, idea.votes, idea.voted]);

  async function vote() {
    if (isVoting || hasVoted) return;
    const previousVoteCount = voteCount;
    setIsVoting(true);
    setVoteMessage('');
    setVoteCount((count) => count + 1);
    try {
      const updated = await api<Idea>(`/ideas/${idea.id}/vote`, { method: 'POST' }, token);
      setVoteCount(updated.votes);
      setHasVoted(true);
      onDone?.();
    } catch (err) {
      setVoteCount(previousVoteCount);
      if (err instanceof ApiClientError && err.code === 'IDEA_ALREADY_VOTED') {
        setHasVoted(true);
        setVoteMessage('تم تسجيل تصويتك لهذه الفكرة من قبل.');
      } else {
        setVoteMessage((err as Error).message);
      }
    } finally {
      setIsVoting(false);
    }
  }
  async function toggleVisibility() {
    await api(`/ideas/${idea.id}/visibility`, { method: 'PATCH', body: JSON.stringify({ visibleToUsers: idea.visibleToUsers === false }) }, token);
    onDone?.();
  }
  async function review(status: 'ACTIVE' | 'REJECTED') {
    await api(`/ideas/${idea.id}/center-status`, { method: 'PATCH', body: JSON.stringify({ status }) }, token);
    onDone?.();
  }
  const visibleToUsers = idea.visibleToUsers !== false;
  const canVote = !readOnly && isPublishedIdea(idea.status);
  const canReview = centerApproval && idea.status === 'PENDING';
  return (
    <article className="item-card">
      <h3>{idea.title}</h3>
      <p className="muted">{idea.user?.name || 'مستخدم'} | {ideaStatusLabel(idea.status)}{admin ? ` | ${visibleToUsers ? 'ظاهرة للمستخدمين' : 'مخفية عن المستخدمين'}` : ''}</p>
      <p>{idea.description}</p>
      {canVote && <button className={hasVoted ? 'btn primary' : 'btn'} type="button" disabled={isVoting || hasVoted} onClick={vote}>{hasVoted ? `تم التصويت (${voteCount})` : isVoting ? 'جار التصويت...' : `تصويت (${voteCount})`}</button>}
      {voteMessage && <p className="error">{voteMessage}</p>}
      {admin && <button className={visibleToUsers ? 'btn danger' : 'btn primary'} type="button" onClick={toggleVisibility}>
        {visibleToUsers ? 'إخفاء عن المستخدمين' : 'إظهار للمستخدمين'}
      </button>}
      {canReview && <div className="inline-actions" style={{ marginTop: 10 }}>
        <button className="btn primary" type="button" onClick={() => review('ACTIVE')}>قبول ونشر</button>
        <button className="btn danger" type="button" onClick={() => review('REJECTED')}>رفض</button>
      </div>}
    </article>
  );
}

function ChallengesPage({ token, admin }: { token: string; admin: boolean }) {
  const { items: challenges, load, page, totalPages, setPage } = usePaginatedData<Challenge>('/challenges', token, 20);
  const [message, setMessage] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createImageName, setCreateImageName] = useState('');
  const [challengeAreaScope, setChallengeAreaScope] = useState<'all' | 'custom'>('all');
  const [challengeAreas, setChallengeAreas] = useState<string[]>([]);

  useEffect(() => {
    if (!admin || !showCreate) return;
    let active = true;
    loadAllCenters(token)
      .then((centers) => {
        if (!active) return;
        setChallengeAreas(groupCentersForMap(centers).map((group) => group.name));
      })
      .catch((err) => {
        if (active) setMessage((err as Error).message);
      });
    return () => {
      active = false;
    };
  }, [admin, showCreate, token]);

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setMessage('');
    try {
      const formData = new FormData(form);
      const imageFile = formData.get('image') as File | null;
      const image = imageFile && imageFile.size > 0 ? await uploadImageFile(imageFile, token) : undefined;
      const targetAreas = challengeAreaScope === 'all'
        ? []
        : formData.getAll('targetAreas').map(String).filter(Boolean);
      if (challengeAreaScope === 'custom' && targetAreas.length === 0) throw new Error('اختار منطقة واحدة على الأقل.');
      await api('/challenges', {
        method: 'POST',
        body: JSON.stringify({
          title: requiredText(form, 'title'),
          description: requiredText(form, 'description'),
          image,
          reward: num(form, 'reward') || 0,
          category: requiredText(form, 'category'),
          location: requiredText(form, 'location'),
          targetAreas,
          deadline: field(form, 'deadline'),
          status: 'ACTIVE'
        })
      }, token);
      form.reset();
      setCreateImageName('');
      setChallengeAreaScope('all');
      setShowCreate(false);
      load();
    } catch (err) {
      setMessage((err as Error).message);
    }
  }
  return (
    <>
      <Header title={admin ? 'إدارة التحديات' : 'التحديات الرياضية والشبابية'} subtitle="شارك في التحديات واجمع النقاط." />
      {admin && <div className="inline-actions" style={{ marginTop: 0 }}>
        <button className="btn primary" type="button" onClick={() => setShowCreate((value) => !value)}>{showCreate ? 'إغلاق إضافة تحدي' : 'إضافة تحدي'}</button>
      </div>}
      {admin && showCreate && <div className="challenge-create-backdrop" role="presentation" onClick={() => setShowCreate(false)}>
        <section className="challenge-create-modal" role="dialog" aria-modal="true" aria-labelledby="challenge-create-title" onClick={(event) => event.stopPropagation()}>
          <div className="challenge-create-header">
            <div>
              <h2 id="challenge-create-title">إضافة تحدي</h2>
              <p className="muted">اكتب بيانات التحدي والصورة ثم انشره للمستخدمين.</p>
            </div>
            <button className="challenge-create-close" type="button" onClick={() => setShowCreate(false)} aria-label="إغلاق">×</button>
          </div>
          <form className="challenge-create-form" onSubmit={create}>
            <label className="form-group challenge-create-wide">
              عنوان التحدي
              <input className="input" name="title" placeholder="مثال: تحدي اللياقة" required />
            </label>
            <label className="form-group">
              الفئة
              <input className="input" name="category" placeholder="رياضي، ثقافي..." required />
            </label>
            <label className="form-group">
              المكان
              <input className="input" name="location" placeholder="مثال: مركز شباب بنها" required />
            </label>
            <label className="form-group">
              النقاط
              <input className="input" name="reward" type="number" min="0" placeholder="عدد النقاط" required />
            </label>
            <label className="form-group">
              الموعد النهائي
              <input className="input" name="deadline" type="date" required />
            </label>
            <label className="form-group challenge-create-wide">
              الوصف
              <textarea className="textarea" name="description" placeholder="اكتب وصف التحدي وشروط المشاركة" required />
            </label>
            <fieldset className="form-group challenge-area-picker challenge-create-wide">
              <legend>المناطق المستهدفة</legend>
              <div className="challenge-area-modes">
                <label className="check-row">
                  <input type="radio" name="areaScope" value="all" checked={challengeAreaScope === 'all'} onChange={() => setChallengeAreaScope('all')} />
                  كل المناطق
                </label>
                <label className="check-row">
                  <input type="radio" name="areaScope" value="custom" checked={challengeAreaScope === 'custom'} onChange={() => setChallengeAreaScope('custom')} />
                  مناطق محددة
                </label>
              </div>
              {challengeAreaScope === 'custom' && <div className="challenge-area-options">
                {challengeAreas.map((area) => (
                  <label className="check-row" key={area}>
                    <input type="checkbox" name="targetAreas" value={area} />
                    {area}
                  </label>
                ))}
                {challengeAreas.length === 0 && <p className="muted">جاري تحميل المناطق...</p>}
              </div>}
            </fieldset>
            <label className="form-group challenge-create-wide">
              صورة التحدي
              <span className="challenge-image-picker">
                <span className="challenge-image-picker-mark" aria-hidden>+</span>
                <span>
                  <strong>{createImageName || 'اختر صورة للتحدي'}</strong>
                  <small>PNG أو JPEG أو WebP أو GIF بدون حد حجم من التطبيق</small>
                </span>
                <input name="image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => setCreateImageName(event.currentTarget.files?.[0]?.name || '')} />
              </span>
            </label>
            <div className="challenge-create-actions">
              <button className="btn primary" type="submit">إضافة التحدي</button>
              <button className="btn btn-outline" type="button" onClick={() => { setShowCreate(false); setCreateImageName(''); }}>إلغاء</button>
            </div>
          </form>
        </section>
      </div>}
      {message && <p className="error">{message}</p>}
      <div className="grid cards" style={{ marginTop: 16 }}>
        {challenges.map((challenge) => <ChallengeCard key={challenge.id} challenge={challenge} token={token} admin={admin} onDone={load} />)}
        {challenges.length === 0 && <EmptyState title="لا توجد تحديات للعرض" detail={admin ? 'استخدم زر إضافة تحدي لإنشاء أول تحدي.' : 'ستظهر التحديات المتاحة هنا عند نشرها.'} />}
      </div>
      <PaginationControls page={page} totalPages={totalPages} setPage={setPage} />
    </>
  );
}

function challengeDisplayStatus(status: string) {
  return status === 'ACTIVE' ? 'ACTIVE' : 'Soon';
}

function ChallengeCard({ challenge, token, admin, onDone }: { challenge: Challenge; token: string; admin?: boolean; onDone: () => void }) {
  const [showJoin, setShowJoin] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const targetAreasText = challenge.targetAreas?.length ? challenge.targetAreas.join('، ') : 'كل المناطق';
  async function join(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setMessage('');
    setBusy(true);
    try {
      const age = num(form, 'age');
      const imageFile = new FormData(form).get('image') as File | null;
      const image = imageFile && imageFile.size > 0 ? await uploadImageFile(imageFile, token) : undefined;
      if (!age) throw new Error('يجب إدخال السن.');
      await api(`/challenges/${challenge.id}/join`, {
        method: 'POST',
        body: JSON.stringify({
          participantName: requiredText(form, 'participantName'),
          phone: requiredText(form, 'phone', 5),
          age,
          notes: field(form, 'notes') || undefined,
          image
        })
      }, token);
      form.reset();
      setShowJoin(false);
      onDone();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    await api(`/challenges/${challenge.id}`, { method: 'DELETE' }, token);
    onDone();
  }
  return (
    <article className="item-card">
      {challenge.image && <div className="challenge-card-image"><img src={challenge.image} alt="" /></div>}
      <h3>{challenge.title}</h3>
      <span className={`badge challenge-status ${challenge.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`}>{challengeDisplayStatus(challenge.status)}</span>
      <p className="muted">{challenge.category}</p>
      {challenge.location && <p className="muted">المكان: {challenge.location}</p>}
      <p className="muted">النطاق: {targetAreasText}</p>
      <p>{challenge.description}</p>
      <p><strong>{challenge.reward}</strong> نقطة | المشاركون {challenge._count?.participations ?? challenge.participants}</p>
      <AuditTimeline items={[
        { title: 'تم النشر', detail: challenge.category, tone: 'success' },
        { title: challenge.status === 'ACTIVE' ? 'نشط' : 'قيد التجهيز', detail: challenge.location || targetAreasText, tone: challenge.status === 'ACTIVE' ? 'success' : 'warning' },
        { title: 'الموعد النهائي', detail: new Date(challenge.deadline).toLocaleDateString('ar-EG'), tone: new Date(challenge.deadline).getTime() < Date.now() ? 'danger' : 'info' }
      ]} />
      {!admin && challenge.joined && <button className="btn primary" disabled>تم الانضمام</button>}
      {!admin && !challenge.joined && !showJoin && <button className="btn primary" type="button" onClick={() => setShowJoin(true)}>انضم الآن</button>}
      {!admin && !challenge.joined && showJoin && <form className="challenge-join-form" onSubmit={join}>
        <div className="challenge-join-fields">
          <label className="form-group">
            الاسم
            <input className="input" name="participantName" placeholder="اسم المشارك" required />
          </label>
          <label className="form-group">
            رقم الهاتف
            <input className="input" name="phone" placeholder="رقم الهاتف" required />
          </label>
          <label className="form-group">
            السن
            <input className="input" name="age" type="number" min="6" max="100" placeholder="السن" required />
          </label>
          <label className="form-group">
            صورة
            <input className="input" name="image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" />
          </label>
          <label className="form-group challenge-join-wide">
            ملاحظات
            <textarea className="textarea" name="notes" placeholder="ملاحظات اختيارية" />
          </label>
        </div>
        <div className="challenge-join-actions">
          <button className="btn primary" type="submit" disabled={busy}>{busy ? 'جاري الإرسال...' : 'إرسال الانضمام'}</button>
          <button className="btn btn-outline" type="button" disabled={busy} onClick={() => { setShowJoin(false); setMessage(''); }}>إلغاء</button>
        </div>
      </form>}
      {message && <p className="error">{message}</p>}
      {admin && <button className="btn danger" onClick={remove}>حذف</button>}
    </article>
  );
}

function complaintStatusLabel(status: string) {
  if (status === 'PENDING') return 'قيد المعالجة';
  if (status === 'RESOLVED') return 'تم الحل';
  if (status === 'REJECTED') return 'مرفوضة';
  if (status === 'ACTIVE') return 'منشورة';
  return status;
}

function complaintReviewLabel(complaint: Complaint) {
  if (complaint.centerReviewStatus === 'PENDING') return 'قيد مراجعة المركز';
  if (complaint.centerReviewStatus === 'REJECTED') return 'مرفوضة من المركز';
  return complaintStatusLabel(complaint.status);
}

function isRejectedComplaint(complaint: Complaint) {
  return complaint.centerReviewStatus === 'REJECTED' || complaint.status === 'REJECTED';
}

function rejectedComplaintDaysLeft(complaint: Complaint) {
  if (!complaint.rejectedAt) return 7;
  const rejectedAt = new Date(complaint.rejectedAt).getTime();
  if (Number.isNaN(rejectedAt)) return 7;
  return Math.max(1, 7 - Math.floor((Date.now() - rejectedAt) / (24 * 60 * 60 * 1000)));
}

function ComplaintsPage({ token, admin, viewOnly = false, centerApproval = false }: { token: string; admin: boolean; viewOnly?: boolean; centerApproval?: boolean }) {
  const { items: complaints, load, page, totalPages, setPage } = usePaginatedData<Complaint>('/complaints', token, 20);
  const [message, setMessage] = useState('');
  const readOnly = admin || viewOnly || centerApproval;
  const splitRejected = !admin && !centerApproval;
  const rejectedComplaints = splitRejected ? complaints.filter(isRejectedComplaint) : [];
  const activeComplaints = splitRejected ? complaints.filter((complaint) => !isRejectedComplaint(complaint)) : complaints;
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setMessage('');
    try {
      await api('/complaints', { method: 'POST', body: JSON.stringify({ title: requiredText(form, 'title'), description: requiredText(form, 'description'), type: requiredText(form, 'type') }) }, token);
      form.reset();
      setMessage('تم إرسال الطلب إلى المركز لمراجعته قبل النشر.');
      load();
    } catch (err) {
      setMessage((err as Error).message);
    }
  }
  return (
    <>
      <Header title={admin ? 'إدارة الشكاوى' : 'الشكاوى والمقترحات'} subtitle="تابع الطلبات والتعامل معها." />
      {!readOnly && <form className="panel grid" onSubmit={create}>
        <select className="select" name="type"><option>شكوى</option><option>مقترح</option></select>
        <input className="input" name="title" placeholder="العنوان" required />
        <textarea className="textarea" name="description" placeholder="التفاصيل" required />
        <button className="btn primary">إرسال للمراجعة</button>
      </form>}
      {message && <p className={message.startsWith('تم ') ? 'muted' : 'error'}>{message}</p>}
      <div className="grid cards" style={{ marginTop: 16 }}>
        {activeComplaints.map((complaint) => <ComplaintCard key={complaint.id} complaint={complaint} token={token} admin={admin} centerApproval={centerApproval} onDone={load} />)}
        {activeComplaints.length === 0 && <EmptyState title="لا توجد شكاوى للعرض" detail={readOnly ? 'ستظهر الطلبات عند وصولها أو اعتمادها.' : 'يمكنك إرسال شكوى أو مقترح من النموذج بالأعلى.'} />}
      </div>
      {rejectedComplaints.length > 0 && <section className="panel rejected-complaints-panel">
        <div className="rejected-complaints-header">
          <h3>الطلبات المرفوضة</h3>
          <p className="muted">تظهر هنا لمدة أسبوع من تاريخ الرفض ثم تختفي تلقائياً.</p>
        </div>
        <div className="grid cards">
          {rejectedComplaints.map((complaint) => (
            <ComplaintCard
              key={complaint.id}
              complaint={complaint}
              token={token}
              admin={admin}
              centerApproval={centerApproval}
              onDone={load}
              rejectedNote={`سيختفي خلال ${rejectedComplaintDaysLeft(complaint)} يوم`}
            />
          ))}
        </div>
      </section>}
      <PaginationControls page={page} totalPages={totalPages} setPage={setPage} />
    </>
  );
}

function ComplaintCard({ complaint, token, admin, centerApproval, onDone, rejectedNote }: { complaint: Complaint; token: string; admin: boolean; centerApproval?: boolean; onDone: () => void; rejectedNote?: string }) {
  async function progress(data: { status?: string; showProgress?: boolean }) {
    await api(`/complaints/${complaint.id}/progress`, { method: 'PATCH', body: JSON.stringify(data) }, token);
    onDone();
  }
  async function review(status: 'ACTIVE' | 'REJECTED') {
    await api(`/complaints/${complaint.id}/center-status`, { method: 'PATCH', body: JSON.stringify({ status }) }, token);
    onDone();
  }
  const canManage = admin || centerApproval;
  const canReview = canManage && complaint.centerReviewStatus === 'PENDING';
  const canUpdateProgress = canManage && (complaint.centerReviewStatus === 'APPROVED' || !complaint.centerReviewStatus);
  const centerName = complaint.center?.name || 'غير محدد';
  const centerArea = complaint.center?.location || 'غير محددة';
  return (
    <article className="item-card">
      <h3>{complaint.title}</h3>
      <p className="muted">{complaint.user?.name || 'مستخدم'} | {complaint.type}</p>
      <p className="muted complaint-center-meta">المركز: {centerName} | المنطقة: {centerArea}</p>
      <p>{complaint.description}</p>
      <span className="badge">{complaintReviewLabel(complaint)}</span>
      <AuditTimeline items={[
        { title: 'تم الإنشاء', detail: new Date(complaint.createdAt).toLocaleDateString('ar-EG'), tone: 'info' },
        { title: complaint.centerReviewStatus === 'PENDING' ? 'مراجعة المركز' : complaint.centerReviewStatus === 'REJECTED' ? 'رفض المركز' : 'اعتماد المركز', detail: centerName, tone: complaint.centerReviewStatus === 'REJECTED' ? 'danger' : complaint.centerReviewStatus === 'PENDING' ? 'warning' : 'success' },
        { title: complaintStatusLabel(complaint.status), detail: complaint.resolvedAt ? new Date(complaint.resolvedAt).toLocaleDateString('ar-EG') : complaint.rejectedAt ? new Date(complaint.rejectedAt).toLocaleDateString('ar-EG') : 'قيد المتابعة', tone: complaint.status === 'REJECTED' ? 'danger' : complaint.status === 'RESOLVED' ? 'success' : 'info' }
      ]} />
      {rejectedNote && <p className="muted rejected-complaint-note">{rejectedNote}</p>}
      {canReview && <div className="inline-actions" style={{ marginTop: 10 }}>
        <button className="btn primary" type="button" onClick={() => review('ACTIVE')}>قبول وبدء المعالجة</button>
        <button className="btn danger" type="button" onClick={() => review('REJECTED')}>رفض</button>
      </div>}
      {canUpdateProgress && <div className="grid" style={{ marginTop: 10 }}>
        <select className="select" value={complaint.status} onChange={(e) => progress({ status: e.target.value })}>
          <option value="PENDING">قيد المعالجة</option>
          <option value="RESOLVED">تم الحل</option>
          <option value="REJECTED">مرفوضة</option>
        </select>
        <button className={complaint.showProgress ? 'btn primary' : 'btn'} type="button" onClick={() => progress({ showProgress: !complaint.showProgress })}>
          {complaint.showProgress ? 'ظاهر للمستخدم' : 'مخفي عن المستخدم'}
        </button>
      </div>}
    </article>
  );
}

function SettingsPage({ token, user, setUser, logout }: { token: string; user: User; setUser: (user: User) => void; logout: () => void }) {
  const [profileMessage, setProfileMessage] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [avatarValue, setAvatarValue] = useState(user.avatar || '');
  const [avatarRemoved, setAvatarRemoved] = useState(false);

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    setProfileMessage('');
    try {
      setAvatarValue(await uploadImageFile(file, token));
      setAvatarRemoved(false);
    } catch (err) {
      setProfileMessage((err as Error).message);
      e.currentTarget.value = '';
    }
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setProfileMessage('');
    try {
      const avatar = avatarRemoved ? '' : avatarValue;
      const updated = await api<User>('/auth/me', { method: 'PATCH', body: JSON.stringify({ name: requiredText(form, 'name'), email: field(form, 'email'), avatar, language: field(form, 'language'), theme: field(form, 'theme') }) }, token);
      setUser(updated);
      setAvatarValue(updated.avatar || '');
      setAvatarRemoved(false);
      writeSession(token, updated);
    } catch (err) {
      setProfileMessage((err as Error).message);
    }
  }
  async function changePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setPasswordMessage('');
    try {
      await api('/auth/password', { method: 'PATCH', body: JSON.stringify({ currentPassword: field(form, 'currentPassword'), newPassword: field(form, 'newPassword') }) }, token);
      form.reset();
      setPasswordMessage('تم تغيير كلمة المرور بنجاح.');
    } catch (err) {
      setPasswordMessage((err as Error).message);
    }
  }
  return (
    <>
      <Header title="الإعدادات" subtitle="تخصيص الملف الشخصي والمظهر." />
      <form className="panel grid settings-profile-form" onSubmit={save}>
        <input className="input" name="name" defaultValue={user.name} minLength={2} required />
        <input className="input" name="email" type="email" defaultValue={user.email} required />
        <div className="settings-avatar-row">
          <span className="settings-avatar-preview">{avatarValue ? <img src={avatarValue} alt="" /> : userInitial(user)}</span>
          <div className="grid">
            <input className="input" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={uploadAvatar} />
            {avatarValue && <button className="btn" type="button" onClick={() => { setAvatarValue(''); setAvatarRemoved(true); }}>Remove photo</button>}
          </div>
        </div>
        <select className="select" name="language" defaultValue={user.language}><option value="ar">العربية</option><option value="en">English</option></select>
        <select className="select" name="theme" defaultValue={user.theme}><option value="light">Light</option><option value="dark">Dark</option></select>
        <button className="btn primary">حفظ</button>
      </form>
      {profileMessage && <p className="error">{profileMessage}</p>}
      <form className="panel grid" onSubmit={changePassword} style={{ marginTop: 16 }}>
        <input className="input" name="currentPassword" type="password" maxLength={128} placeholder="كلمة المرور الحالية" required />
        <input className="input" name="newPassword" type="password" minLength={6} maxLength={128} placeholder="كلمة مرور جديدة (6 أحرف على الأقل)" required />
        <button className="btn primary">تغيير كلمة المرور</button>
        {passwordMessage && <p className={passwordMessage.includes('نجاح') ? 'muted' : 'error'}>{passwordMessage}</p>}
      </form>
      <div className="panel" style={{ marginTop: 16 }}>
        <button className="btn danger" type="button" onClick={logout}>تسجيل الخروج</button>
      </div>
    </>
  );
}

function formatChatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function ChatPage({ token, currentUser, admin }: { token: string; currentUser: User; admin: boolean }) {
  const searchParams = useSearchParams();
  const { items: centers } = usePaginatedData<Center>('/centers', token, 100, '', admin);
  const [thread, setThread] = useState<'all' | 'center'>('center');
  const [selectedCenterId, setSelectedCenterId] = useState<number | undefined>();
  const [draft, setDraft] = useState('');
  const [chatSearch, setChatSearch] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const centerFromUrl = Number(searchParams.get('centerId'));
    if (admin && Number.isInteger(centerFromUrl) && centerFromUrl > 0) {
      setThread('center');
      setSelectedCenterId(centerFromUrl);
      return;
    }
    if (admin && !selectedCenterId && centers.length > 0) setSelectedCenterId(centers[0].id);
  }, [admin, centers, searchParams, selectedCenterId]);

  const activeCenter = centers.find((center) => center.id === selectedCenterId);
  const canLoadPrivate = !admin || Boolean(selectedCenterId);
  const chatPath = thread === 'all'
    ? '/chat/messages?scope=all'
    : admin && selectedCenterId
      ? `/chat/messages?scope=center&centerId=${selectedCenterId}`
      : '/chat/messages?scope=center';
  const { data: messages, setData: setMessages, error: loadError, load } = useData<ChatMessage[]>(chatPath, token, [], thread === 'all' || canLoadPrivate);
  const visibleMessages = messages || [];
  const filteredMessages = useMemo(() => {
    const query = chatSearch.trim().toLowerCase();
    if (!query) return visibleMessages;
    return visibleMessages.filter((message) =>
      `${message.body} ${message.sender?.name || ''} ${message.center?.name || ''} ${message.center?.location || ''}`.toLowerCase().includes(query)
    );
  }, [chatSearch, visibleMessages]);
  const canSend = admin || thread === 'center';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [visibleMessages.length, thread, selectedCenterId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      load();
    }, 7000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSend) return;
    setError('');
    setSending(true);
    try {
      const sent = await api<ChatMessage>('/chat/messages', {
        method: 'POST',
        body: JSON.stringify({
          scope: thread,
          centerId: admin && thread === 'center' ? selectedCenterId : undefined,
          body: draft
        })
      }, token);
      setMessages((current) => [...(current || []), sent]);
      setDraft('');
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Header title={admin ? 'محادثات المراكز' : 'محادثة المديرية'} subtitle={admin ? 'أرسل رسالة لمركز محدد أو لجميع المراكز مرة واحدة.' : 'تابع رسائل المديرية ورد على محادثة مركزك.'} />
      <section className="chat-layout">
        <aside className="panel chat-sidebar">
          <div className="chat-thread-tabs" role="tablist" aria-label="Chat threads">
            <button className={`btn ${thread === 'center' ? 'primary' : ''}`} type="button" onClick={() => setThread('center')}>مركز محدد</button>
            <button className={`btn ${thread === 'all' ? 'primary' : ''}`} type="button" onClick={() => setThread('all')}>كل المراكز</button>
          </div>
          {admin && thread === 'center' && (
            <label className="form-group">
              المركز
              <select className="select" value={selectedCenterId || ''} onChange={(event) => setSelectedCenterId(Number(event.target.value) || undefined)}>
                {centers.map((center) => <option key={center.id} value={center.id}>{center.name} - {center.location}</option>)}
              </select>
            </label>
          )}
          <div className="chat-thread-summary">
            <span>{thread === 'all' ? 'رسالة عامة' : 'محادثة خاصة'}</span>
            <strong>{thread === 'all' ? 'كل المراكز' : admin ? activeCenter?.name || 'اختر مركزا' : 'مركزك'}</strong>
            <p className="muted">{thread === 'all' ? 'تظهر هذه الرسائل لجميع مسؤولي المراكز.' : 'هذه المحادثة مرئية للمديرية والمركز فقط.'}</p>
          </div>
          <input className="input chat-search" type="search" value={chatSearch} onChange={(event) => setChatSearch(event.target.value)} placeholder="بحث في الرسائل" />
        </aside>
        <section className="panel chat-panel">
          <div className="chat-messages" aria-live="polite">
            {filteredMessages.map((message) => {
              const own = message.senderId === currentUser.id;
              return (
                <article key={message.id} className={`chat-message ${own ? 'own' : ''}`}>
                  <div className="chat-bubble">
                    <div className="chat-message-meta">
                      <strong>{message.sender?.name || (message.senderRole === 'DIRECTORATE_MANAGER' ? 'المديرية' : 'المركز')}</strong>
                      <span>{formatChatTime(message.createdAt)}</span>
                    </div>
                    <p>{message.body}</p>
                  </div>
                </article>
              );
            })}
            {visibleMessages.length === 0 && <EmptyState title="لا توجد رسائل بعد" detail={thread === 'all' ? 'ابدأ بإرسال إعلان لجميع المراكز.' : 'ابدأ محادثة مباشرة مع المركز.'} />}
            {visibleMessages.length > 0 && filteredMessages.length === 0 && <EmptyState title="لا توجد نتائج" detail="جرّب كلمة بحث أخرى داخل هذه المحادثة." />}
            <div ref={bottomRef} />
          </div>
          <form className="chat-composer" onSubmit={send}>
            <textarea
              className="textarea"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder={canSend ? 'اكتب رسالتك...' : 'الرد متاح في محادثة المركز الخاصة فقط'}
              disabled={!canSend || sending}
              maxLength={2000}
              required
            />
            <button className="btn primary" type="submit" disabled={!canSend || sending || !draft.trim()}>{sending ? 'جار الإرسال...' : 'إرسال'}</button>
          </form>
          {!canSend && <p className="muted chat-note">الرسائل العامة للقراءة فقط لمسؤولي المراكز. استخدم محادثة المركز للرد على المديرية.</p>}
          {(error || loadError) && <p className="error">{error || loadError}</p>}
        </section>
      </section>
    </>
  );
}

export function AdminPage({ section }: { section: 'dashboard' | 'users' | 'centers' | 'map' | 'ideas' | 'challenges' | 'complaints' | 'reports' | 'chat' | 'settings' }) {
  const router = useRouter();
  const { token, user, setUser, ready, logout } = useSession(true);
  const allowed = user && canManageAccounts(user.role);

  useEffect(() => {
    if (ready && user?.role === 'CENTER_MANAGER') router.replace('/center/reports');
  }, [ready, router, user]);

  if (!ready || !user) return <main className="auth-page">جاري التحميل...</main>;

  return (
    <Shell admin>
      {!allowed && <Header title="غير مصرح" subtitle="لا تملك صلاحية فتح هذه الصفحة." />}
      {allowed && section === 'dashboard' && <AdminDashboard token={token} />}
      {allowed && section === 'users' && <UsersAdmin token={token} currentUser={user} />}
      {allowed && section === 'centers' && <CentersPage token={token} admin />}
      {allowed && section === 'map' && <CentersMapPage token={token} />}
      {allowed && section === 'ideas' && <IdeasPage token={token} admin />}
      {allowed && section === 'challenges' && <ChallengesPage token={token} admin />}
      {allowed && section === 'complaints' && <ComplaintsPage token={token} admin />}
      {allowed && section === 'reports' && <ReportsAdmin token={token} currentUser={user} />}
      {allowed && section === 'chat' && <ChatPage token={token} currentUser={user} admin />}
      {allowed && section === 'settings' && <SettingsPage token={token} user={user} setUser={setUser} logout={logout} />}
    </Shell>
  );
}

function AdminDashboard({ token }: { token: string }) {
  const { data, error: statsError } = useData<any>('/stats/admin', token);
  const month = currentMonthValue();
  const { data: summary, error: summaryError } = useData<MonthlyReportsSummary>(`/monthly-reports/summary?month=${month}`, token, null);
  const uploadedCenters = summary?.uploadedCenters || 0;
  const missingReports = summary?.missingCentersTotal || 0;
  const rejectedUploads = (summary?.latestUploads || []).filter((upload) => upload.status === 'REJECTED').length;
  const monthIndicators = summary ? [
    { label: 'المراكز الرافعة', value: uploadedCenters, tone: 'success' as AlertTone },
    { label: 'المراكز الناقصة', value: missingReports, tone: missingReports ? 'danger' as AlertTone : 'success' as AlertTone },
    { label: 'ملفات مرفوضة', value: rejectedUploads, tone: rejectedUploads ? 'warning' as AlertTone : 'success' as AlertTone },
    { label: 'آخر الرفعات', value: summary.latestUploads.length, tone: 'info' as AlertTone }
  ] : [];
  const alerts: AlertItem[] = [
    summary ? (missingReports > 0 ? { title: 'تقارير شهرية ناقصة', detail: `${missingReports} مركز لم يرفع تقرير ${formatMonthArabic(month)}.`, tone: 'danger', href: '/admin/reports' } : { title: 'التقارير مكتملة', detail: `كل المراكز رفعت تقرير ${formatMonthArabic(month)}.`, tone: 'success', href: '/admin/reports' }) : { title: 'تحميل مؤشرات التقارير', detail: 'يتم جلب بيانات الشهر من التقارير الفعلية.', tone: 'info', href: '/admin/reports' },
    rejectedUploads > 0 ? { title: 'ملفات Excel مرفوضة', detail: `${rejectedUploads} ملف يحتاج مراجعة من آخر الرفعات.`, tone: 'warning', href: '/admin/reports' } : undefined,
    data?.newComplaints > 0 ? { title: 'شكاوى جديدة', detail: `${data.newComplaints} شكوى تحتاج معالجة.`, tone: 'warning', href: '/admin/complaints' } : undefined,
    data?.pendingIdeas > 0 ? { title: 'أفكار معلقة', detail: `${data.pendingIdeas} فكرة بانتظار قرار النشر.`, tone: 'info', href: '/admin/ideas' } : undefined
  ].filter(Boolean) as AlertItem[];
  const indicatorsError = summaryError || statsError;
  return (
    <>
      <Header title="لوحة تشغيل المديرية" subtitle="نظرة فورية على التقارير، الشكاوى، النشاط، والتنبيهات." />
      <div className="grid stats">
        <Stat title="المستخدمون" value={data?.totalUsers || 0} />
        <Stat title="المراكز" value={data?.activeCenters || 0} />
        <Stat title="أفكار معلقة" value={data?.pendingIdeas || 0} />
        <Stat title="شكاوى جديدة" value={data?.newComplaints || 0} />
      </div>
      <div className="dashboard-grid" style={{ marginTop: 16 }}>
        <AlertPanel title="تنبيهات تشغيلية" alerts={alerts} />
        <NotificationsPanel items={(summary?.latestUploads || []).slice(0, 5).map((upload) => ({
          title: upload.status === 'REJECTED' ? 'رفع مرفوض' : upload.status === 'ACCEPTED' ? 'رفع مقبول' : 'تحديث تقرير',
          detail: `${upload.centerName || 'مركز'} - ${formatMonthArabic(upload.month)} - ${upload.originalName}`,
          tone: upload.status === 'REJECTED' ? 'danger' : upload.status === 'ACCEPTED' ? 'success' : 'info',
          href: '/admin/reports'
        }))} />
      </div>
      <div className="dashboard-grid" style={{ marginTop: 16 }}>
        {summary ? (
          <MiniBarChart title="تغطية تقارير الشهر" items={monthIndicators} />
        ) : (
          <section className="panel analytics-card">
            <h3>تغطية تقارير الشهر</h3>
            <EmptyState title={indicatorsError ? 'تعذر تحميل المؤشرات' : 'جاري تحميل المؤشرات'} detail={indicatorsError || 'يتم جلب أرقام الشهر من التقارير الفعلية.'} />
          </section>
        )}
        {summary ? (
          <MiniBarChart title="آخر 6 أشهر" items={summary.monthlyStatistics.map((item) => ({
            label: formatMonthArabic(item.month),
            value: item.uploadedCenters,
            tone: 'info'
          }))} />
        ) : (
          <section className="panel analytics-card">
            <h3>آخر 6 أشهر</h3>
            <EmptyState title={summaryError ? 'تعذر تحميل الإحصاءات' : 'جاري تحميل الإحصاءات'} detail={summaryError || 'ستظهر إحصاءات الرفع الشهرية بعد اكتمال التحميل.'} />
          </section>
        )}
      </div>
      <div className="panel activity-panel" style={{ marginTop: 16 }}>
        <h3>أحدث النشاطات</h3>
        <AuditTimeline items={(data?.recentActivities || []).map((activity: Activity) => ({
          title: activity.action,
          detail: activity.userName || 'النظام',
          tone: 'info'
        }))} />
      </div>
    </>
  );
}

function UsersAdmin({ token, currentUser }: { token: string; currentUser: User }) {
  const { items: users, load, page, totalPages, setPage } = usePaginatedData<User>('/users', token, 20);
  const { items: centers } = usePaginatedData<Center>('/centers', token, 100);
  const allowedRoles = roleOptionsFor(currentUser.role);
  const [editing, setEditing] = useState<User | null>(null);
  const [createRole, setCreateRole] = useState<Role>(allowedRoles[0]?.value || 'USER');
  const [editingRole, setEditingRole] = useState<Role>('USER');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  function centerIdFrom(form: HTMLFormElement) {
    const value = num(form, 'centerId');
    return value || null;
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage('');
    try {
      await action();
      await load();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    await run(async () => {
      const role = field(form, 'role') as Role;
      await api('/users', {
        method: 'POST',
        body: JSON.stringify({
          name: field(form, 'name'),
          email: field(form, 'email'),
          password: field(form, 'password'),
          role,
          centerId: centerIdFrom(form),
          points: hasUserPoints(role) ? num(form, 'points') || 0 : 0,
          status: 'ACTIVE',
          isActive: true
        })
      }, token);
      form.reset();
      setCreateRole(allowedRoles[0]?.value || 'USER');
      setShowCreate(false);
    });
  }

  async function update(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const form = e.currentTarget;
    await run(async () => {
      const isActive = new FormData(form).get('isActive') === 'on';
      const role = field(form, 'role') as Role;
      await api(`/users/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: field(form, 'name'),
          email: field(form, 'email'),
          role,
          centerId: centerIdFrom(form),
          points: hasUserPoints(role) ? num(form, 'points') || 0 : 0,
          status: isActive ? 'ACTIVE' : 'INACTIVE',
          isActive
        })
      }, token);
      const resetPassword = field(form, 'resetPassword');
      if (resetPassword) {
        await api(`/users/${editing.id}/password`, { method: 'PATCH', body: JSON.stringify({ password: resetPassword }) }, token);
      }
      setEditing(null);
    });
  }

  function beginEdit(user: User) {
    if (editing?.id === user.id) {
      setEditing(null);
      return;
    }
    setShowCreate(false);
    setEditing(user);
    setEditingRole(user.role);
  }

  async function toggleActive(user: User) {
    if (user.id === currentUser.id) {
      setMessage('لا يمكنك تعطيل حسابك الحالي.');
      return;
    }
    await run(async () => {
      await api(`/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !user.isActive, status: !user.isActive ? 'ACTIVE' : 'INACTIVE' })
      }, token);
    });
  }

  return (
    <>
      <Header title="إدارة المستخدمين" />
      <div className="inline-actions" style={{ marginTop: 0 }}>
        <button className="btn primary" type="button" onClick={() => {
          setShowCreate((value) => !value);
          setEditing(null);
        }}>{showCreate ? 'إغلاق إضافة مستخدم' : 'إضافة مستخدم'}</button>
      </div>
      {showCreate && <form className="panel form-grid" onSubmit={create} style={{ marginTop: 16 }}>
        <input className="input" name="name" placeholder="الاسم" required />
        <input className="input" name="email" type="email" placeholder="البريد" required />
        <input className="input" name="password" type="password" minLength={6} maxLength={128} placeholder="كلمة مرور مؤقتة (6 أحرف على الأقل)" required />
        {hasUserPoints(createRole) && <input className="input" name="points" type="number" placeholder="النقاط" />}
        <select className="select" name="role" value={createRole} onChange={(e) => setCreateRole(e.target.value as Role)}>
          {allowedRoles.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <CenterSelect centers={centers} />
        <button className="btn primary" disabled={busy}>إضافة</button>
      </form>}
      {message && <p className="error">{message}</p>}
      {editing && <form key={editing.id} className="panel form-grid" onSubmit={update} style={{ marginTop: 16 }}>
        <h3>تعديل مستخدم</h3>
        <input className="input" name="name" defaultValue={editing.name} required />
        <input className="input" name="email" type="email" defaultValue={editing.email} required />
        {hasUserPoints(editingRole) && <input className="input" name="points" type="number" defaultValue={editing.points} />}
        <select className="select" name="role" value={editingRole} onChange={(e) => setEditingRole(e.target.value as Role)}>
          {allowedRoles.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <CenterSelect centers={centers} defaultValue={editing.centerId || ''} />
        <input className="input" name="resetPassword" type="password" minLength={6} maxLength={128} placeholder="كلمة مرور جديدة (اختياري، 6 أحرف على الأقل)" />
        <label className="check-row"><input type="checkbox" name="isActive" defaultChecked={editing.isActive} /> حساب نشط</label>
        <button className="btn primary" disabled={busy}>حفظ</button>
        <button className="btn" type="button" onClick={() => setEditing(null)}>إلغاء</button>
      </form>}
      <div className="panel table-wrap" style={{ marginTop: 16 }}>
        <table className="table">
          <thead><tr><th>الاسم</th><th>البريد</th><th>الدور</th><th>المركز</th><th>الحالة</th><th></th></tr></thead>
          <tbody>{users.map((user) => {
            const center = centers.find((item) => item.id === user.centerId);
            return <tr key={user.id}>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>{roleLabel(user.role)}</td>
              <td>{center?.name || '-'}</td>
              <td><span className="badge">{user.isActive ? 'نشط' : 'معطل'}</span></td>
              <td>
                <div className="inline-actions">
                  <button className={editing?.id === user.id ? 'btn primary' : 'btn'} type="button" onClick={() => beginEdit(user)}>{editing?.id === user.id ? 'إغلاق التعديل' : 'تعديل'}</button>
                  <button className={user.isActive ? 'btn danger' : 'btn'} onClick={() => toggleActive(user)}>{user.isActive ? 'تعطيل' : 'تفعيل'}</button>
                </div>
              </td>
            </tr>;
          })}
          {users.length === 0 && <tr><td colSpan={6}><EmptyState title="لا يوجد مستخدمون للعرض" detail="ستظهر الحسابات هنا بعد إضافتها." /></td></tr>}
          </tbody>
        </table>
      </div>
      <PaginationControls page={page} totalPages={totalPages} setPage={setPage} />
    </>
  );
}

function CenterUsersPage({ token }: { token: string }) {
  const { items: users, error, load, page, totalPages, setPage } = usePaginatedData<User>('/users', token, 20);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setMessage('');
    setLoading(true);
    try {
      await api('/users', {
        method: 'POST',
        body: JSON.stringify({ name: field(form, 'name'), email: field(form, 'email'), password: field(form, 'password'), role: 'USER', status: 'ACTIVE', isActive: true })
      }, token);
      form.reset();
      setShowCreate(false);
      load();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Header title="مستخدمو المركز" subtitle="الحسابات المرتبطة بمركزك فقط." />
      <div className="inline-actions" style={{ marginTop: 0 }}>
        <button className="btn primary" type="button" onClick={() => setShowCreate((value) => !value)}>{showCreate ? 'إغلاق إضافة مستخدم' : 'إضافة مستخدم'}</button>
      </div>
      {showCreate && <form className="panel form-grid" onSubmit={create} style={{ marginTop: 16 }}>
        <input className="input" name="name" placeholder="اسم المستخدم" required />
        <input className="input" name="email" type="email" placeholder="البريد الإلكتروني" required />
        <input className="input" name="password" type="password" minLength={6} maxLength={128} placeholder="كلمة مرور مؤقتة (6 أحرف على الأقل)" required />
        <button className="btn primary" disabled={loading}>{loading ? 'جاري الإضافة...' : 'إضافة مستخدم للمركز'}</button>
      </form>}
      {message && <p className="error">{message}</p>}
      {error && <p className="error">{error}</p>}
      <div className="panel table-wrap" style={{ marginTop: 16 }}>
        <table className="table">
          <thead><tr><th>الاسم</th><th>البريد</th><th>الدور</th><th>الحالة</th><th>آخر دخول</th></tr></thead>
          <tbody>{users.map((user) => <tr key={user.id}>
            <td>{user.name}</td>
            <td>{user.email}</td>
            <td>{roleLabel(user.role)}</td>
            <td><span className="badge">{user.isActive ? 'نشط' : 'معطل'}</span></td>
            <td>{user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('ar-EG') : '-'}</td>
          </tr>)}
          {users.length === 0 && <tr><td colSpan={5}><EmptyState title="لا يوجد مستخدمون للمركز" detail="أضف أول مستخدم ليظهر في هذه القائمة." /></td></tr>}
          </tbody>
        </table>
      </div>
      <PaginationControls page={page} totalPages={totalPages} setPage={setPage} />
    </>
  );
}

function currentMonthValue() {
  return monthValue(new Date());
}

function previousMonthValue() {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return monthValue(date);
}

function monthValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

const arabicMonthFormatter = new Intl.DateTimeFormat('ar-EG', { month: 'long' });
const arabicYearFormatter = new Intl.NumberFormat('ar-EG', { useGrouping: false });
const arabicMonthNames = Array.from({ length: 12 }, (_, index) => arabicMonthFormatter.format(new Date(2024, index, 1)));

function parseMonthValue(value: string) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (!match) return parseMonthValue(currentMonthValue());
  return { year: Number(match[1]), month: Number(match[2]) };
}

function buildMonthValue(year: number, month: number) {
  const safeYear = Math.min(2100, Math.max(2000, Math.trunc(year || new Date().getFullYear())));
  const safeMonth = Math.min(12, Math.max(1, Math.trunc(month || 1)));
  return `${safeYear}-${String(safeMonth).padStart(2, '0')}`;
}

function formatMonthArabic(value?: string | null) {
  if (!value) return '-';
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (!match) return value;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return `${arabicMonthFormatter.format(new Date(year, month - 1, 1))} ${arabicYearFormatter.format(year)}`;
}

function ArabicMonthPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { year, month } = parseMonthValue(value);
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const start = Math.min(currentYear - 5, year - 2);
    const end = Math.max(currentYear + 1, year + 2);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [year]);

  return (
    <div className="month-picker" dir="rtl">
      <select className="select" value={String(month)} onChange={(e) => onChange(buildMonthValue(year, Number(e.target.value)))}>
        {arabicMonthNames.map((name, index) => <option key={name} value={String(index + 1)}>{name}</option>)}
      </select>
      <select className="select month-year-select" value={String(year)} onChange={(e) => onChange(buildMonthValue(Number(e.target.value), month))}>
        {years.map((yearOption) => <option key={yearOption} value={String(yearOption)}>{arabicYearFormatter.format(yearOption)}</option>)}
      </select>
    </div>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 }).format(value);
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function ReportsAdmin({ token, currentUser }: { token: string; currentUser: User }) {
  const [month, setMonth] = useState(currentMonthValue());
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const isManager = canManageAccounts(currentUser.role);
  const { items: centers } = usePaginatedData<Center>('/centers', token, 100, '', isManager);
  const { data: summary, load: loadSummary } = useData<MonthlyReportsSummary>(`/monthly-reports/summary?month=${month}`, token, null);
  const { items: reports, load: loadReports, page: reportsPage, totalPages: reportsTotalPages, setPage: setReportsPage } = usePaginatedData<MonthlyReportRow>(`/monthly-reports?month=${month}`, token, 20);

  async function refresh() {
    await Promise.all([loadSummary(), loadReports()]);
  }

  async function upload(e: FormEvent<HTMLFormElement>, replace = false) {
    e.preventDefault();
    const form = e.currentTarget;
    const selectedFile = new FormData(form).get('file') as File | null;
    if (!selectedFile || selectedFile.size === 0) {
      setMessage('يرجى اختيار ملف Excel أولاً.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const data = new FormData(form);
      data.set('replace', String(replace));
      const result = await apiForm<MonthlyReportUploadResponse>('/monthly-reports/upload', data, token);
      form.reset();
      setMessage(result.message);
      if (result.report.month !== month) {
        setMonth(result.report.month);
      } else {
        await refresh();
      }
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'DUPLICATE_REPORT' && !replace) {
        const confirmed = window.confirm('يوجد تقرير لهذا المركز في نفس الشهر. هل تريد استبداله بالملف الجديد؟');
        if (confirmed) {
          await upload(e, true);
          return;
        }
      }
      setMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function download(path: string) {
    setMessage('');
    try {
      const file = await downloadApi(path, token);
      saveBlob(file.blob, file.filename);
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  const reportAlerts: AlertItem[] = [
    (summary?.missingCentersTotal || 0) > 0 ? { title: 'مراكز لم ترفع التقرير', detail: `${summary?.missingCentersTotal || 0} مركز لم يرفع تقرير ${formatMonthArabic(month)}.`, tone: 'danger' } : { title: 'اكتمل الرفع', detail: 'لا توجد مراكز متأخرة في الصفحة الحالية.', tone: 'success' },
    (summary?.latestUploads || []).some((upload) => upload.status === 'REJECTED') ? { title: 'ملفات مرفوضة', detail: 'توجد ملفات Excel مرفوضة تحتاج إعادة رفع.', tone: 'warning' } : undefined,
    reports.length > 0 ? { title: 'سجل تدقيق متاح', detail: 'يمكنك متابعة الرفع والاستبدال من آخر الملفات والنشاطات.', tone: 'info' } : undefined
  ].filter(Boolean) as AlertItem[];

  return (
    <>
      <Header title="التقارير الشهرية" subtitle="رفع ملف Excel للمركز وتجميع بيانات الشهر تلقائياً." />
      <div className="panel form-grid reports-toolbar">
        {isManager && <div className="actions">
          <button className={`btn ${month === currentMonthValue() ? 'primary' : ''}`} type="button" onClick={() => setMonth(currentMonthValue())}>الشهر الحالي</button>
          <button className={`btn ${month === previousMonthValue() ? 'primary' : ''}`} type="button" onClick={() => setMonth(previousMonthValue())}>الشهر الماضي</button>
        </div>}
        <label className="grid">
          <span className="muted">الشهر</span>
          <ArabicMonthPicker value={month} onChange={setMonth} />
        </label>
        <button className="btn" type="button" onClick={() => download(`/monthly-reports/template?month=${month}`)}>تحميل القالب</button>
        {isManager && <button className="btn primary" type="button" onClick={() => download(`/monthly-reports/export?month=${month}`)}>Download Monthly Report</button>}
      </div>

      <form className="panel grid" onSubmit={upload} style={{ marginTop: 16 }}>
        {isManager && <CenterSelect centers={centers} required />}
        <input className="input" name="file" type="file" accept=".xlsx" required />
        <button className="btn primary" disabled={loading}>{loading ? 'جاري الرفع...' : 'رفع ملف Excel'}</button>
        {message && <p className={message.includes('بنجاح') || message.includes('تم') ? 'muted' : 'error'}>{message}</p>}
      </form>

      <div className="grid stats" style={{ marginTop: 16 }}>
        <Stat title="إجمالي الإيرادات" value={formatMoney(summary?.totalRevenues || 0)} />
        <Stat title="إجمالي المصروفات" value={formatMoney(summary?.totalExpenses || 0)} />
        <Stat title="المراكز التي رفعت" value={summary?.uploadedCenters || 0} />
        <Stat title="إجمالي الندوات" value={summary?.totalSeminars || 0} />
      </div>

      <div className="dashboard-grid" style={{ marginTop: 16 }}>
        <AlertPanel title="تنبيهات التقارير" alerts={reportAlerts} />
        <MiniBarChart title="تحليل مالي للشهر" items={[
          { label: 'الإيرادات', value: summary?.totalRevenues || 0, tone: 'success' },
          { label: 'المصروفات', value: summary?.totalExpenses || 0, tone: 'warning' }
        ]} valueLabel={(value) => formatMoney(value)} />
      </div>

      <div className="panel table-wrap" style={{ marginTop: 16 }}>
        <h3>بيانات المراكز</h3>
        <table className="table">
          <thead><tr><th>المركز</th><th>الفعالية</th><th>الشهر</th><th>الإيرادات</th><th>المصروفات</th><th>الندوات</th><th>الملف</th></tr></thead>
          <tbody>{reports.map((report) => <tr key={report.id}>
            <td>{report.centerName}</td>
            <td>{report.eventName || '-'}</td>
            <td>{formatMonthArabic(report.month)}</td>
            <td>{formatMoney(report.revenues)}</td>
            <td>{formatMoney(report.expenses)}</td>
            <td>{report.seminarsCount}</td>
            <td>{report.sourceFileName || '-'}</td>
          </tr>)}
          {reports.length === 0 && <tr><td colSpan={7}><EmptyState title="لا توجد تقارير لهذا الشهر" detail="ارفع ملف Excel أو اختر شهر آخر." /></td></tr>}
          </tbody>
        </table>
      </div>
      <PaginationControls page={reportsPage} totalPages={reportsTotalPages} setPage={setReportsPage} />

      <div className="panel table-wrap" style={{ marginTop: 16 }}>
        <h3>إحصائيات الأشهر الأخيرة</h3>
        <table className="table">
          <thead><tr><th>الشهر</th><th>الإيرادات</th><th>المصروفات</th><th>الندوات</th><th>المراكز</th></tr></thead>
          <tbody>{(summary?.monthlyStatistics || []).map((item) => <tr key={item.month}>
            <td>{formatMonthArabic(item.month)}</td>
            <td>{formatMoney(item.totalRevenues)}</td>
            <td>{formatMoney(item.totalExpenses)}</td>
            <td>{item.totalSeminars}</td>
            <td>{item.uploadedCenters}</td>
          </tr>)}
          {(summary?.monthlyStatistics || []).length === 0 && <tr><td colSpan={5}><EmptyState title="لا توجد إحصائيات شهرية بعد" detail="ستظهر الإحصائيات بعد رفع التقارير." /></td></tr>}
          </tbody>
        </table>
      </div>

      <div className="grid cards" style={{ marginTop: 16 }}>
        <div className="panel">
          <h3>{(summary?.missingCenters || []).length === 0 ? 'اكتمل رفع التقارير' : 'المراكز التي لم ترفع التقرير'}</h3>
          {(summary?.missingCenters || []).length === 0 && <p className="muted">لا توجد مراكز متأخرة عن رفع تقرير هذا الشهر.</p>}
          {(summary?.missingCenters || []).map((center) => <p key={center.id} className="muted">{center.name} - {center.location}</p>)}
        </div>
        <div className="panel">
          <h3>أحدث عمليات الرفع</h3>
          <AuditTimeline items={(summary?.latestUploads || []).map((upload) => ({
            title: upload.status === 'REJECTED' ? 'ملف مرفوض' : upload.status === 'ACCEPTED' ? 'ملف مقبول' : 'تحديث ملف',
            detail: `${upload.centerName || '-'} - ${formatMonthArabic(upload.month)} - ${upload.originalName}`,
            tone: upload.status === 'REJECTED' ? 'danger' : upload.status === 'ACCEPTED' ? 'success' : 'info'
          }))} />
          {(summary?.latestUploads || []).length === 0 && <EmptyState title="لا توجد عمليات رفع حديثة" detail="ستظهر هنا آخر الملفات المرفوعة." />}
        </div>
      </div>
    </>
  );
}
