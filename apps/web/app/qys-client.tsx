'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { MonthlyReportRow, MonthlyReportsSummary, Paginated } from '@qys/shared';
import { api, apiForm, ApiClientError, downloadApi } from '../lib/api';
import { field, num, useData, usePaginatedData } from './qys/data';
import { canAccessReports, canManageAccounts, canOpenAdmin, roleLabel, roleOptionsFor } from './qys/permissions';
import { useSession, writeSession } from './qys/session';
import { Header, PaginationControls } from './qys/shared-ui';
import type { Activity, Center, Challenge, Complaint, Idea, MonthlyReportUploadResponse, Report, Role, User } from './qys/types';

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

const avatarUploadLimitBytes = 750 * 1024;

function readAvatarFile(file: File) {
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
    throw new Error('Profile photo must be PNG, JPEG, WebP, or GIF.');
  }
  if (file.size > avatarUploadLimitBytes) {
    throw new Error('Profile photo must be 750 KB or smaller.');
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read profile photo.'));
    reader.readAsDataURL(file);
  });
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
  if (href.includes('reports')) {
    return <NavSvg><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M8 17v-3" /><path d="M12 17v-6" /><path d="M16 17v-4" /></NavSvg>;
  }
  if (href.includes('settings')) {
    return <NavSvg><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21a2 2 0 0 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 0 1 4 0v.09A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 0 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z" /></NavSvg>;
  }
  return <NavSvg><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></NavSvg>;
}

function statIconFor(title: string) {
  if (title.includes('مستخدم')) return 'U';
  if (title.includes('مركز') || title.includes('المراكز')) return 'C';
  if (title.includes('فكر')) return 'I';
  if (title.includes('تحد')) return 'T';
  if (title.includes('شك')) return '!';
  if (title.includes('تصويت')) return 'V';
  if (title.includes('إيراد')) return '$';
  if (title.includes('مصروف')) return 'E';
  if (title.includes('ندوات')) return 'N';
  return 'D';
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
        ['/admin/settings', t.settings]
      ]
    : user?.role === 'CENTER_MANAGER'
      ? [
        ['/center/reports', t.reports],
        ['/center/map', t.map],
        ['/center/ideas', t.ideas],
        ['/center/users', t.users],
        ['/center/challenges', t.challenges],
        ['/center/complaints', t.complaints],
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
          {canOpenAdmin(user.role) && !admin && <Link className="nav-link" href="/admin"><span className="nav-icon" aria-hidden>D</span><span>لوحة الإدارة</span></Link>}
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

export function CenterPage({ section }: { section: 'reports' | 'map' | 'ideas' | 'users' | 'challenges' | 'complaints' | 'settings' }) {
  const router = useRouter();
  const { token, user, setUser, ready, logout } = useSession(true);

  useEffect(() => {
    if (ready && user?.role !== 'CENTER_MANAGER') router.replace('/dashboard');
  }, [ready, router, user]);

  if (!ready || !user) return <main className="auth-page">جاري التحميل...</main>;

  return (
    <Shell>
      {user.role !== 'CENTER_MANAGER' && <Header title="غير مصرح" subtitle="لا تملك صلاحية فتح هذه الصفحة." />}
      {user.role === 'CENTER_MANAGER' && section === 'reports' && <ReportsAdmin token={token} currentUser={user} />}
      {user.role === 'CENTER_MANAGER' && section === 'map' && <CentersMapPage token={token} />}
      {user.role === 'CENTER_MANAGER' && section === 'ideas' && <IdeasPage token={token} admin={false} centerApproval />}
      {user.role === 'CENTER_MANAGER' && section === 'users' && <CenterUsersPage token={token} />}
      {user.role === 'CENTER_MANAGER' && section === 'challenges' && <ChallengesPage token={token} admin={false} />}
      {user.role === 'CENTER_MANAGER' && section === 'complaints' && <ComplaintsPage token={token} admin={false} centerApproval />}
      {user.role === 'CENTER_MANAGER' && section === 'settings' && <SettingsPage token={token} user={user} setUser={setUser} logout={logout} />}
    </Shell>
  );
}

function UserDashboard({ token }: { token: string }) {
  const { data } = useData<any>('/stats/me', token);
  return (
    <>
      <Header title="أهلاً بك في منصتك الرياضية" subtitle="تابع نشاطك وشارك في الخدمات المتاحة." />
      <div className="grid stats">
        <Stat title="أفكاري" value={data?.ideas || 0} />
        <Stat title="تحدياتي" value={data?.joinedChallenges || 0} />
        <Stat title="طلباتي" value={data?.complaints || 0} />
        <Stat title="التصويتات" value={data?.totalVotes || 0} />
      </div>
      <div className="grid cards" style={{ marginTop: 16 }}>
        {(data?.suggestedChallenges || []).map((challenge: Challenge) => <ChallengeCard key={challenge.id} challenge={challenge} token={token} onDone={() => location.reload()} />)}
        {(data?.recentIdeas || []).map((idea: Idea) => <IdeaCard key={idea.id} idea={idea} token={token} />)}
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

function CentersPage({ token, admin }: { token: string; admin: boolean }) {
  const [message, setMessage] = useState('');
  const { items: centers, load, page, totalPages, setPage } = usePaginatedData<Center>('/centers', token, 24);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setMessage('');
    try {
      await api('/centers', { method: 'POST', body: JSON.stringify({ name: requiredText(form, 'name'), location: requiredText(form, 'location'), type: requiredText(form, 'type'), description: requiredText(form, 'description'), rating: num(form, 'rating') }) }, token);
      form.reset();
      load();
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  return (
    <>
      <Header title={admin ? 'إدارة المراكز' : 'المراكز الشبابية والرياضية'} subtitle="استكشف مراكز الشباب في محافظة القليوبية." />
      {admin && <form className="panel form-grid" onSubmit={save} style={{ marginTop: 16 }}>
        <input className="input" name="name" placeholder="اسم المركز" required />
        <input className="input" name="location" placeholder="المنطقة" required />
        <input className="input" name="type" placeholder="النوع" defaultValue="مركز شباب" required />
        <input className="input" name="rating" placeholder="التقييم" type="number" step="0.1" />
        <input className="input" name="description" placeholder="الوصف" required />
        <button className="btn primary">إضافة</button>
      </form>}
      {message && <p className="error">{message}</p>}
      <div className="panel centers-directory" style={{ marginTop: 16 }}>
        <div className="centers-directory-header">
          <h3 className="centers-directory-title centers-directory-title-center">اسم المركز والمنطقة</h3>
          <h3 className="centers-directory-title centers-directory-title-login">{admin ? 'بيانات الدخول (المدير)' : 'بيانات المركز'}</h3>
        </div>
        <div className="centers-directory-list">
          {centers.map((center) => <CenterDirectoryRow key={center.id} center={center} admin={admin} token={token} onDone={load} />)}
        </div>
      </div>
      <PaginationControls page={page} totalPages={totalPages} setPage={setPage} />
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const areaGroups = useMemo(() => groupCentersForMap(centers), [centers]);
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
        marker.on('click', () => setSelectedArea(point.groupName));
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
      <div className="grid stats">
        <Stat title="المراكز على الخريطة" value={loading ? '...' : centers.length} />
        <Stat title="المناطق" value={areaGroups.length} />
        <Stat title="المراكز في المنطقة" value={selectedGroup?.centers.length || 0} />
      </div>
      {error && <p className="error">{error}</p>}
      <div className="centers-map-layout">
        <section className="panel centers-map-panel">
          <div className="centers-map-canvas" aria-label="خريطة مراكز الشباب في القليوبية" dir="ltr" ref={mapElementRef}>
            {loading && <div className="map-loading">جاري تحميل المراكز...</div>}
          </div>
        </section>
        <aside className="panel map-directory">
          <div className="map-directory-header">
            <div>
              <h3>{selectedGroup?.name || 'المناطق'}</h3>
              <p className="muted">{selectedGroup ? `${selectedGroup.centers.length} مركز` : 'لا توجد بيانات'}</p>
            </div>
            <span className="badge">{areaGroups.length}</span>
          </div>
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
              <article key={center.id} className="map-center-row">
                <div>
                  <h4>{center.name}</h4>
                  <p className="muted">{center.type}</p>
                </div>
                <span>{center.rating || '-'}</span>
              </article>
            ))}
          </div>
        </aside>
      </div>
    </>
  );
}

function centerManagerCredentials(center: Center) {
  return {
    email: `manager_${center.id}@platform.com`,
    password: 'center123'
  };
}

function LocationPin() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function CenterDirectoryRow({ center, admin, token, onDone }: { center: Center; admin: boolean; token: string; onDone: () => void }) {
  const credentials = centerManagerCredentials(center);

  async function remove() {
    await api(`/centers/${center.id}`, { method: 'DELETE' }, token);
    onDone();
  }

  return (
    <article className="center-directory-row">
      <div className="center-directory-info">
        <div className="center-directory-image">
          {center.image ? <img src={center.image} alt="" /> : <span>{center.name.trim().charAt(0)}</span>}
        </div>
        <div className="center-directory-copy">
          <h3>{center.name}</h3>
          <p><span className="center-location-icon"><LocationPin /></span>{center.location}</p>
        </div>
      </div>
      <div className="center-login-card">
        {admin ? (
          <>
            <div className="center-login-line">
              <span>البريد:</span>
              <strong className="center-login-email">{credentials.email}</strong>
            </div>
            <div className="center-login-line">
              <span>كلمة المرور:</span>
              <strong className="center-login-password">{credentials.password}</strong>
            </div>
            <button className="btn danger center-delete-btn" type="button" onClick={remove}>حذف</button>
          </>
        ) : (
          <>
            <div className="center-login-line">
              <span>النوع:</span>
              <strong>{center.type}</strong>
            </div>
            <div className="center-login-line">
              <span>التقييم:</span>
              <strong>{center.rating || '-'}</strong>
            </div>
          </>
        )}
      </div>
    </article>
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
      </div>
      <PaginationControls page={page} totalPages={totalPages} setPage={setPage} />
    </>
  );
}

function IdeaCard({ idea, token, readOnly, admin, centerApproval, onDone }: { idea: Idea; token: string; readOnly?: boolean; admin?: boolean; centerApproval?: boolean; onDone?: () => void }) {
  async function vote() {
    await api(`/ideas/${idea.id}/vote`, { method: 'POST' }, token);
    onDone?.();
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
      {canVote && <button className="btn" onClick={vote}>تصويت ({idea.votes})</button>}
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
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setMessage('');
    try {
      await api('/challenges', { method: 'POST', body: JSON.stringify({ title: requiredText(form, 'title'), description: requiredText(form, 'description'), reward: num(form, 'reward') || 0, category: requiredText(form, 'category'), deadline: field(form, 'deadline'), status: 'ACTIVE' }) }, token);
      form.reset();
      load();
    } catch (err) {
      setMessage((err as Error).message);
    }
  }
  return (
    <>
      <Header title={admin ? 'إدارة التحديات' : 'التحديات الرياضية والشبابية'} subtitle="شارك في التحديات واجمع النقاط." />
      {admin && <form className="panel form-grid" onSubmit={create}>
        <input className="input" name="title" placeholder="عنوان التحدي" required />
        <input className="input" name="description" placeholder="الوصف" required />
        <input className="input" name="reward" type="number" placeholder="النقاط" required />
        <input className="input" name="category" placeholder="الفئة" required />
        <input className="input" name="deadline" type="date" required />
        <button className="btn primary">إضافة</button>
      </form>}
      {message && <p className="error">{message}</p>}
      <div className="grid cards" style={{ marginTop: 16 }}>
        {challenges.map((challenge) => <ChallengeCard key={challenge.id} challenge={challenge} token={token} admin={admin} onDone={load} />)}
      </div>
      <PaginationControls page={page} totalPages={totalPages} setPage={setPage} />
    </>
  );
}

function ChallengeCard({ challenge, token, admin, onDone }: { challenge: Challenge; token: string; admin?: boolean; onDone: () => void }) {
  async function join() {
    await api(`/challenges/${challenge.id}/join`, { method: 'POST' }, token);
    onDone();
  }
  async function remove() {
    await api(`/challenges/${challenge.id}`, { method: 'DELETE' }, token);
    onDone();
  }
  return (
    <article className="item-card">
      <h3>{challenge.title}</h3>
      <p className="muted">{challenge.category} | {challenge.status}</p>
      <p>{challenge.description}</p>
      <p><strong>{challenge.reward}</strong> نقطة | المشاركون {challenge._count?.participations ?? challenge.participants}</p>
      {!admin && <button className="btn primary" disabled={challenge.joined} onClick={join}>{challenge.joined ? 'تم الانضمام' : 'انضم الآن'}</button>}
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

function ComplaintsPage({ token, admin, viewOnly = false, centerApproval = false }: { token: string; admin: boolean; viewOnly?: boolean; centerApproval?: boolean }) {
  const { items: complaints, load, page, totalPages, setPage } = usePaginatedData<Complaint>('/complaints', token, 20);
  const [message, setMessage] = useState('');
  const readOnly = admin || viewOnly || centerApproval;
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
        <select className="select" name="type"><option>شكوى</option><option>مقترح</option><option>صيانة</option><option>أخرى</option></select>
        <input className="input" name="title" placeholder="العنوان" required />
        <textarea className="textarea" name="description" placeholder="التفاصيل" required />
        <button className="btn primary">إرسال للمراجعة</button>
      </form>}
      {message && <p className={message.startsWith('تم ') ? 'muted' : 'error'}>{message}</p>}
      <div className="grid cards" style={{ marginTop: 16 }}>
        {complaints.map((complaint) => <ComplaintCard key={complaint.id} complaint={complaint} token={token} admin={admin} centerApproval={centerApproval} onDone={load} />)}
      </div>
      <PaginationControls page={page} totalPages={totalPages} setPage={setPage} />
    </>
  );
}

function ComplaintCard({ complaint, token, admin, centerApproval, onDone }: { complaint: Complaint; token: string; admin: boolean; centerApproval?: boolean; onDone: () => void }) {
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
  return (
    <article className="item-card">
      <h3>{complaint.title}</h3>
      <p className="muted">{complaint.user?.name || 'مستخدم'} | {complaint.type}</p>
      <p>{complaint.description}</p>
      <span className="badge">{complaintReviewLabel(complaint)}</span>
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
      setAvatarValue(await readAvatarFile(file));
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
      <form className="panel grid" onSubmit={save}>
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

export function AdminPage({ section }: { section: 'dashboard' | 'users' | 'centers' | 'map' | 'ideas' | 'challenges' | 'complaints' | 'reports' | 'settings' }) {
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
      {allowed && section === 'settings' && <SettingsPage token={token} user={user} setUser={setUser} logout={logout} />}
    </Shell>
  );
}

function AdminDashboard({ token }: { token: string }) {
  const { data } = useData<any>('/stats/admin', token);
  return (
    <>
      <Header title="الإحصائيات العامة" subtitle="نظرة تشغيلية على المنصة." />
      <div className="grid stats">
        <Stat title="المستخدمون" value={data?.totalUsers || 0} />
        <Stat title="المراكز" value={data?.activeCenters || 0} />
        <Stat title="الأفكار المعلقة" value={data?.pendingIdeas || 0} />
        <Stat title="الشكاوى الجديدة" value={data?.newComplaints || 0} />
      </div>
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>أحدث النشاطات</h3>
        {(data?.recentActivities || []).map((activity: Activity) => <p key={activity.id} className="muted">{activity.action} - {activity.userName || 'النظام'}</p>)}
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
      <form className="panel form-grid" onSubmit={create}>
        <input className="input" name="name" placeholder="الاسم" required />
        <input className="input" name="email" type="email" placeholder="البريد" required />
        <input className="input" name="password" type="password" minLength={6} maxLength={128} placeholder="كلمة مرور مؤقتة (6 أحرف على الأقل)" required />
        {hasUserPoints(createRole) && <input className="input" name="points" type="number" placeholder="النقاط" />}
        <select className="select" name="role" value={createRole} onChange={(e) => setCreateRole(e.target.value as Role)}>
          {allowedRoles.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <CenterSelect centers={centers} />
        <button className="btn primary" disabled={busy}>إضافة</button>
      </form>
      {message && <p className="error">{message}</p>}
      {editing && <form key={editing.id} className="panel form-grid" onSubmit={update} style={{ marginTop: 16 }}>
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
                  <button className="btn" onClick={() => beginEdit(user)}>تعديل</button>
                  <button className={user.isActive ? 'btn danger' : 'btn'} onClick={() => toggleActive(user)}>{user.isActive ? 'تعطيل' : 'تفعيل'}</button>
                </div>
              </td>
            </tr>;
          })}</tbody>
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
      <form className="panel form-grid" onSubmit={create}>
        <input className="input" name="name" placeholder="اسم المستخدم" required />
        <input className="input" name="email" type="email" placeholder="البريد الإلكتروني" required />
        <input className="input" name="password" type="password" minLength={6} maxLength={128} placeholder="كلمة مرور مؤقتة (6 أحرف على الأقل)" required />
        <button className="btn primary" disabled={loading}>{loading ? 'جاري الإضافة...' : 'إضافة مستخدم للمركز'}</button>
      </form>
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
          </tr>)}</tbody>
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

      <div className="panel table-wrap" style={{ marginTop: 16 }}>
        <h3>بيانات المراكز</h3>
        <table className="table">
          <thead><tr><th>المركز</th><th>الشهر</th><th>الإيرادات</th><th>المصروفات</th><th>الندوات</th><th>الملف</th></tr></thead>
          <tbody>{reports.map((report) => <tr key={report.id}>
            <td>{report.centerName}</td>
            <td>{formatMonthArabic(report.month)}</td>
            <td>{formatMoney(report.revenues)}</td>
            <td>{formatMoney(report.expenses)}</td>
            <td>{report.seminarsCount}</td>
            <td>{report.sourceFileName || '-'}</td>
          </tr>)}</tbody>
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
          </tr>)}</tbody>
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
          {(summary?.latestUploads || []).map((upload) => <p key={upload.id} className="muted">{upload.originalName} - {formatMonthArabic(upload.month)} - {upload.status} - {upload.centerName || '-'}</p>)}
        </div>
      </div>
    </>
  );
}
