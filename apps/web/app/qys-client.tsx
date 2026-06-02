'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { MonthlyReportRow, MonthlyReportsSummary } from '@qys/shared';
import { api, apiForm, ApiClientError, downloadApi } from '../lib/api';

type Role = 'DIRECTORATE_MANAGER' | 'CENTER_MANAGER' | 'USER';
type User = {
  id: number;
  name: string;
  email: string;
  role: Role;
  centerId?: number | null;
  createdBy?: number | null;
  isActive: boolean;
  lastLogin?: string | null;
  points: number;
  status: string;
  avatar?: string | null;
  language: 'ar' | 'en';
  theme: 'light' | 'dark';
};
type Center = { id: number; name: string; location: string; rating?: number; type: string; image?: string; description: string };
type Challenge = { id: number; title: string; description: string; reward: number; status: string; category: string; participants: number; deadline: string; joined?: boolean; _count?: { participations: number } };
type Idea = { id: number; userId: number; title: string; description: string; status: string; votes: number; createdAt: string; user?: { name: string } };
type Complaint = { id: number; userId: number; title: string; description: string; type: string; status: string; createdAt: string; user?: { name: string } };
type Activity = { id: number; action: string; userName?: string; timestamp: string };
type Report = { id: number; title: string; type: string; content: string; status: string; date: string; userId?: number | null; centerId?: number | null };
type MonthlyReportUploadResponse = { replaced: boolean; message: string; report: MonthlyReportRow };

const storageKey = 'qys_session';

const roleOptions: Array<{ value: Role; label: string }> = [
  { value: 'USER', label: 'مستخدم' },
  { value: 'CENTER_MANAGER', label: 'مسؤول مركز' },
  { value: 'DIRECTORATE_MANAGER', label: 'مدير مديرية' }
];
const adminRoles: Role[] = ['DIRECTORATE_MANAGER'];
const managementRoles: Role[] = [...adminRoles, 'CENTER_MANAGER'];

function roleLabel(role: Role) {
  return roleOptions.find((option) => option.value === role)?.label || role;
}

function canOpenAdmin(role?: Role) {
  return canManageAccounts(role);
}

function canManageAccounts(role?: Role) {
  return Boolean(role && adminRoles.includes(role));
}

function canAccessReports(role?: Role) {
  return Boolean(role && managementRoles.includes(role));
}

function canAssignRole(actorRole: Role | undefined, targetRole: Role) {
  if (actorRole === 'DIRECTORATE_MANAGER') return ['CENTER_MANAGER', 'USER'].includes(targetRole);
  return false;
}

function roleOptionsFor(actorRole?: Role) {
  return roleOptions.filter((option) => canAssignRole(actorRole, option.value));
}

const labels = {
  ar: {
    login: 'تسجيل الدخول',
    signup: 'إنشاء حساب',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    name: 'الاسم',
    dashboard: 'الرئيسية',
    centers: 'المراكز',
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

function readSession(): { token: string; user: User } | null {
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

function writeSession(token: string, user: User) {
  window.sessionStorage.setItem(storageKey, JSON.stringify({ token, user }));
}

function useSession(required = true) {
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

function field(form: HTMLFormElement, name: string) {
  return String(new FormData(form).get(name) || '').trim();
}

function num(form: HTMLFormElement, name: string) {
  const value = field(form, name);
  return value ? Number(value) : undefined;
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
  const { data: centers } = useData<Center[]>('/centers', '', [], mode === 'signup');
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
          {mode === 'signup' && <CenterSelect centers={centers || []} required />}
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

function navIconFor(href: string) {
  if (href.includes('users')) return 'U';
  if (href.includes('centers')) return 'C';
  if (href.includes('ideas')) return 'I';
  if (href.includes('challenges')) return 'T';
  if (href.includes('complaints')) return '!';
  if (href.includes('reports')) return 'R';
  if (href.includes('settings')) return 'S';
  return 'D';
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

function Shell({ children, admin = false }: { children: React.ReactNode; admin?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, ready, logout } = useSession(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const t = labels[user?.language || 'ar'];
  const nav = admin
    ? [
        ['/admin', t.dashboard],
        ['/admin/users', t.users],
        ['/admin/centers', t.centers],
        ['/admin/ideas', t.ideas],
        ['/admin/challenges', t.challenges],
        ['/admin/complaints', t.complaints],
        ['/admin/reports', t.reports]
      ]
    : user?.role === 'CENTER_MANAGER'
      ? [
        ['/center/reports', t.reports],
        ['/center/ideas', t.ideas],
        ['/center/users', t.users],
        ['/center/challenges', t.challenges],
        ['/center/complaints', t.complaints]
      ]
      : [
        ['/dashboard', t.dashboard],
        ['/centers', t.centers],
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
            <div className="search-wrapper header-search">
              <span className="search-icon" aria-hidden>⌕</span>
              <input type="search" placeholder="بحث سريع..." />
            </div>
          </div>
          <div className="header-right">
            {!admin && <div className="points-badge"><span>{user.points || 0}</span><span>نقطة</span></div>}
            <button className="user-profile-header" type="button" onClick={logout} title={t.logout}>
              <span className="user-avatar">{userInitial(user)}</span>
              <span className="user-info-text">
                <strong>{user.name}</strong>
                <span>{roleDescription(user.role)} | {t.logout}</span>
              </span>
            </button>
          </div>
        </header>
        <div className="content-wrapper">{children}</div>
      </main>
    </div>
  );
}

function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="page-header fade-in">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
    </div>
  );
}

function useData<T>(path: string, token?: string, initial: T | null = null, enabled = true) {
  const [data, setData] = useState<T | null>(initial);
  const [error, setError] = useState('');
  const load = () => enabled ? api<T>(path, undefined, token).then(setData).catch((err) => setError((err as Error).message)) : Promise.resolve();
  useEffect(() => {
    if (token !== undefined && enabled) load();
  }, [path, token, enabled]);
  return { data, setData, error, load };
}

export function UserPage({ section }: { section: 'dashboard' | 'centers' | 'ideas' | 'challenges' | 'complaints' | 'reports' | 'settings' }) {
  const { token, user, setUser } = useSession(true);
  return (
    <Shell>
      {section === 'dashboard' && <UserDashboard token={token} />}
      {section === 'centers' && <CentersPage token={token} admin={false} />}
      {section === 'ideas' && <IdeasPage token={token} admin={false} />}
      {section === 'challenges' && <ChallengesPage token={token} admin={false} />}
      {section === 'complaints' && <ComplaintsPage token={token} admin={false} />}
      {section === 'reports' && user && canAccessReports(user.role) && <ReportsAdmin token={token} currentUser={user} />}
      {section === 'reports' && user && !canAccessReports(user.role) && <Header title="غير مصرح" subtitle="لا تملك صلاحية فتح هذه الصفحة." />}
      {section === 'settings' && user && <SettingsPage token={token} user={user} setUser={setUser} />}
    </Shell>
  );
}

export function CenterPage({ section }: { section: 'reports' | 'ideas' | 'users' | 'challenges' | 'complaints' }) {
  const router = useRouter();
  const { token, user, ready } = useSession(true);

  useEffect(() => {
    if (ready && user?.role !== 'CENTER_MANAGER') router.replace('/dashboard');
  }, [ready, router, user]);

  if (!ready || !user) return <main className="auth-page">جاري التحميل...</main>;

  return (
    <Shell>
      {user.role !== 'CENTER_MANAGER' && <Header title="غير مصرح" subtitle="لا تملك صلاحية فتح هذه الصفحة." />}
      {user.role === 'CENTER_MANAGER' && section === 'reports' && <ReportsAdmin token={token} currentUser={user} />}
      {user.role === 'CENTER_MANAGER' && section === 'ideas' && <IdeasPage token={token} admin={false} />}
      {user.role === 'CENTER_MANAGER' && section === 'users' && <CenterUsersPage token={token} />}
      {user.role === 'CENTER_MANAGER' && section === 'challenges' && <ChallengesPage token={token} admin={false} />}
      {user.role === 'CENTER_MANAGER' && section === 'complaints' && <ComplaintsPage token={token} admin={false} />}
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
  const { data, load } = useData<Center[]>('/centers', token, []);
  const [q, setQ] = useState('');
  const centers = useMemo(() => (data || []).filter((center) => `${center.name} ${center.location}`.includes(q)), [data, q]);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    await api('/centers', { method: 'POST', body: JSON.stringify({ name: field(form, 'name'), location: field(form, 'location'), type: field(form, 'type'), description: field(form, 'description'), rating: num(form, 'rating') }) }, token);
    form.reset();
    load();
  }

  return (
    <>
      <Header title={admin ? 'إدارة المراكز' : 'المراكز الشبابية والرياضية'} subtitle="استكشف مراكز الشباب في محافظة القليوبية." />
      <input className="input" placeholder="بحث بالمركز أو المنطقة" value={q} onChange={(e) => setQ(e.target.value)} />
      {admin && <form className="panel form-grid" onSubmit={save} style={{ marginTop: 16 }}>
        <input className="input" name="name" placeholder="اسم المركز" required />
        <input className="input" name="location" placeholder="المنطقة" required />
        <input className="input" name="type" placeholder="النوع" defaultValue="مركز شباب" required />
        <input className="input" name="rating" placeholder="التقييم" type="number" step="0.1" />
        <input className="input" name="description" placeholder="الوصف" required />
        <button className="btn primary">إضافة</button>
      </form>}
      <div className="grid cards" style={{ marginTop: 16 }}>
        {centers.map((center) => <CenterCard key={center.id} center={center} admin={admin} token={token} onDone={load} />)}
      </div>
    </>
  );
}

function CenterCard({ center, admin, token, onDone }: { center: Center; admin: boolean; token: string; onDone: () => void }) {
  async function remove() {
    await api(`/centers/${center.id}`, { method: 'DELETE' }, token);
    onDone();
  }
  return (
    <article className="item-card">
      {center.image && <img src={center.image} alt="" style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8, marginBottom: 10 }} />}
      <h3>{center.name}</h3>
      <p className="muted">{center.location} | {center.type}</p>
      <p>{center.description}</p>
      <span className="badge">تقييم {center.rating || '-'}</span>
      {admin && <button className="btn danger" style={{ marginInlineStart: 8 }} onClick={remove}>حذف</button>}
    </article>
  );
}

function IdeasPage({ token, admin }: { token: string; admin: boolean }) {
  const { data, load } = useData<Idea[]>('/ideas', token, []);
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    await api('/ideas', { method: 'POST', body: JSON.stringify({ title: field(form, 'title'), description: field(form, 'description') }) }, token);
    form.reset();
    load();
  }
  return (
    <>
      <Header title={admin ? 'إدارة بنك الأفكار' : 'بنك الأفكار التطويرية'} subtitle="شارك واقرأ أفكار تطوير مراكز الشباب." />
      {!admin && <form className="panel grid" onSubmit={create}>
        <input className="input" name="title" placeholder="عنوان الفكرة" required />
        <textarea className="textarea" name="description" placeholder="وصف الفكرة" required />
        <button className="btn primary">نشر الفكرة</button>
      </form>}
      <div className="grid cards" style={{ marginTop: 16 }}>
        {(data || []).map((idea) => <IdeaCard key={idea.id} idea={idea} token={token} admin={admin} onDone={load} />)}
      </div>
    </>
  );
}

function IdeaCard({ idea, token, admin, onDone }: { idea: Idea; token: string; admin?: boolean; onDone?: () => void }) {
  async function vote() {
    await api(`/ideas/${idea.id}/vote`, { method: 'POST' }, token);
    onDone?.();
  }
  async function status(value: string) {
    await api(`/ideas/${idea.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: value }) }, token);
    onDone?.();
  }
  return (
    <article className="item-card">
      <h3>{idea.title}</h3>
      <p className="muted">{idea.user?.name || 'مستخدم'} | {idea.status}</p>
      <p>{idea.description}</p>
      <button className="btn" onClick={vote}>تصويت ({idea.votes})</button>
      {admin && <select className="select" style={{ marginTop: 10 }} value={idea.status} onChange={(e) => status(e.target.value)}>
        <option value="PENDING">تحت الدراسة</option>
        <option value="RESOLVED">مقبولة</option>
        <option value="REJECTED">مرفوضة</option>
      </select>}
    </article>
  );
}

function ChallengesPage({ token, admin }: { token: string; admin: boolean }) {
  const { data, load } = useData<Challenge[]>('/challenges', token, []);
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    await api('/challenges', { method: 'POST', body: JSON.stringify({ title: field(form, 'title'), description: field(form, 'description'), reward: num(form, 'reward') || 0, category: field(form, 'category'), deadline: field(form, 'deadline'), status: 'ACTIVE' }) }, token);
    form.reset();
    load();
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
      <div className="grid cards" style={{ marginTop: 16 }}>
        {(data || []).map((challenge) => <ChallengeCard key={challenge.id} challenge={challenge} token={token} admin={admin} onDone={load} />)}
      </div>
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

function ComplaintsPage({ token, admin }: { token: string; admin: boolean }) {
  const { data, load } = useData<Complaint[]>('/complaints', token, []);
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    await api('/complaints', { method: 'POST', body: JSON.stringify({ title: field(form, 'title'), description: field(form, 'description'), type: field(form, 'type') }) }, token);
    form.reset();
    load();
  }
  return (
    <>
      <Header title={admin ? 'إدارة الشكاوى' : 'الشكاوى والمقترحات'} subtitle="تابع الطلبات والتعامل معها." />
      {!admin && <form className="panel grid" onSubmit={create}>
        <select className="select" name="type"><option>شكوى</option><option>مقترح</option><option>صيانة</option><option>أخرى</option></select>
        <input className="input" name="title" placeholder="العنوان" required />
        <textarea className="textarea" name="description" placeholder="التفاصيل" required />
        <button className="btn primary">إرسال</button>
      </form>}
      <div className="grid cards" style={{ marginTop: 16 }}>
        {(data || []).map((complaint) => <ComplaintCard key={complaint.id} complaint={complaint} token={token} admin={admin} onDone={load} />)}
      </div>
    </>
  );
}

function ComplaintCard({ complaint, token, admin, onDone }: { complaint: Complaint; token: string; admin: boolean; onDone: () => void }) {
  async function status(value: string) {
    await api(`/complaints/${complaint.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: value }) }, token);
    onDone();
  }
  return (
    <article className="item-card">
      <h3>{complaint.title}</h3>
      <p className="muted">{complaint.user?.name || 'مستخدم'} | {complaint.type}</p>
      <p>{complaint.description}</p>
      <span className="badge">{complaint.status}</span>
      {admin && <select className="select" style={{ marginTop: 10 }} value={complaint.status} onChange={(e) => status(e.target.value)}>
        <option value="PENDING">قيد المعالجة</option>
        <option value="RESOLVED">تم الحل</option>
        <option value="REJECTED">مرفوضة</option>
      </select>}
    </article>
  );
}

function SettingsPage({ token, user, setUser }: { token: string; user: User; setUser: (user: User) => void }) {
  const [passwordMessage, setPasswordMessage] = useState('');

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const updated = await api<User>('/auth/me', { method: 'PATCH', body: JSON.stringify({ name: field(form, 'name'), avatar: field(form, 'avatar'), language: field(form, 'language'), theme: field(form, 'theme') }) }, token);
    setUser(updated);
    writeSession(token, updated);
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
        <input className="input" name="name" defaultValue={user.name} />
        <input className="input" name="avatar" defaultValue={user.avatar || ''} placeholder="رابط الصورة" />
        <select className="select" name="language" defaultValue={user.language}><option value="ar">العربية</option><option value="en">English</option></select>
        <select className="select" name="theme" defaultValue={user.theme}><option value="light">Light</option><option value="dark">Dark</option></select>
        <button className="btn primary">حفظ</button>
      </form>
      <form className="panel grid" onSubmit={changePassword} style={{ marginTop: 16 }}>
        <input className="input" name="currentPassword" type="password" maxLength={128} placeholder="كلمة المرور الحالية" required />
        <input className="input" name="newPassword" type="password" minLength={6} maxLength={128} placeholder="كلمة مرور جديدة (6 أحرف على الأقل)" required />
        <button className="btn primary">تغيير كلمة المرور</button>
        {passwordMessage && <p className={passwordMessage.includes('نجاح') ? 'muted' : 'error'}>{passwordMessage}</p>}
      </form>
    </>
  );
}

export function AdminPage({ section }: { section: 'dashboard' | 'users' | 'centers' | 'ideas' | 'challenges' | 'complaints' | 'reports' }) {
  const router = useRouter();
  const { token, user, ready } = useSession(true);
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
      {allowed && section === 'ideas' && <IdeasPage token={token} admin />}
      {allowed && section === 'challenges' && <ChallengesPage token={token} admin />}
      {allowed && section === 'complaints' && <ComplaintsPage token={token} admin />}
      {allowed && section === 'reports' && <ReportsAdmin token={token} currentUser={user} />}
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
  const { data, load } = useData<User[]>('/users', token, []);
  const { data: centers } = useData<Center[]>('/centers', token, []);
  const [editing, setEditing] = useState<User | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const allowedRoles = roleOptionsFor(currentUser.role);

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
      await api('/users', {
        method: 'POST',
        body: JSON.stringify({
          name: field(form, 'name'),
          email: field(form, 'email'),
          password: field(form, 'password'),
          role: field(form, 'role'),
          centerId: centerIdFrom(form),
          points: num(form, 'points') || 0,
          status: 'ACTIVE',
          isActive: true
        })
      }, token);
      form.reset();
    });
  }

  async function update(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const form = e.currentTarget;
    await run(async () => {
      const isActive = new FormData(form).get('isActive') === 'on';
      await api(`/users/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: field(form, 'name'),
          email: field(form, 'email'),
          role: field(form, 'role'),
          centerId: centerIdFrom(form),
          points: num(form, 'points') || 0,
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
        <input className="input" name="points" type="number" placeholder="النقاط" />
        <select className="select" name="role">
          {allowedRoles.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <CenterSelect centers={centers || []} />
        <button className="btn primary" disabled={busy}>إضافة</button>
      </form>
      {message && <p className="error">{message}</p>}
      {editing && <form key={editing.id} className="panel form-grid" onSubmit={update} style={{ marginTop: 16 }}>
        <input className="input" name="name" defaultValue={editing.name} required />
        <input className="input" name="email" type="email" defaultValue={editing.email} required />
        <input className="input" name="points" type="number" defaultValue={editing.points} />
        <select className="select" name="role" defaultValue={editing.role}>
          {allowedRoles.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <CenterSelect centers={centers || []} defaultValue={editing.centerId || ''} />
        <input className="input" name="resetPassword" type="password" minLength={6} maxLength={128} placeholder="كلمة مرور جديدة (اختياري، 6 أحرف على الأقل)" />
        <label className="check-row"><input type="checkbox" name="isActive" defaultChecked={editing.isActive} /> حساب نشط</label>
        <button className="btn primary" disabled={busy}>حفظ</button>
        <button className="btn" type="button" onClick={() => setEditing(null)}>إلغاء</button>
      </form>}
      <div className="panel table-wrap" style={{ marginTop: 16 }}>
        <table className="table">
          <thead><tr><th>الاسم</th><th>البريد</th><th>الدور</th><th>المركز</th><th>الحالة</th><th></th></tr></thead>
          <tbody>{(data || []).map((user) => {
            const center = (centers || []).find((item) => item.id === user.centerId);
            return <tr key={user.id}>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>{roleLabel(user.role)}</td>
              <td>{center?.name || '-'}</td>
              <td><span className="badge">{user.isActive ? 'نشط' : 'معطل'}</span></td>
              <td>
                <div className="inline-actions">
                  <button className="btn" onClick={() => setEditing(user)}>تعديل</button>
                  <button className={user.isActive ? 'btn danger' : 'btn'} onClick={() => toggleActive(user)}>{user.isActive ? 'تعطيل' : 'تفعيل'}</button>
                </div>
              </td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </>
  );
}

function CenterUsersPage({ token }: { token: string }) {
  const { data, error, load } = useData<User[]>('/users', token, []);
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
          <tbody>{(data || []).map((user) => <tr key={user.id}>
            <td>{user.name}</td>
            <td>{user.email}</td>
            <td>{roleLabel(user.role)}</td>
            <td><span className="badge">{user.isActive ? 'نشط' : 'معطل'}</span></td>
            <td>{user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('ar-EG') : '-'}</td>
          </tr>)}</tbody>
        </table>
      </div>
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
  const { data: centers } = useData<Center[]>('/centers', token, [], isManager);
  const { data: summary, load: loadSummary } = useData<MonthlyReportsSummary>(`/monthly-reports/summary?month=${month}`, token, null);
  const { data: reports, load: loadReports } = useData<MonthlyReportRow[]>(`/monthly-reports?month=${month}`, token, []);

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
          <input className="input" type="month" value={month} onChange={(e) => setMonth(e.target.value || currentMonthValue())} />
        </label>
        <button className="btn" type="button" onClick={() => download(`/monthly-reports/template?month=${month}`)}>تحميل القالب</button>
        {isManager && <button className="btn primary" type="button" onClick={() => download(`/monthly-reports/export?month=${month}`)}>Download Monthly Report</button>}
      </div>

      <form className="panel grid" onSubmit={upload} style={{ marginTop: 16 }}>
        {isManager && <CenterSelect centers={centers || []} required />}
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
          <tbody>{(reports || []).map((report) => <tr key={report.id}>
            <td>{report.centerName}</td>
            <td>{report.month}</td>
            <td>{formatMoney(report.revenues)}</td>
            <td>{formatMoney(report.expenses)}</td>
            <td>{report.seminarsCount}</td>
            <td>{report.sourceFileName || '-'}</td>
          </tr>)}</tbody>
        </table>
      </div>

      <div className="grid cards" style={{ marginTop: 16 }}>
        <div className="panel">
          <h3>المراكز التي لم ترفع</h3>
          {(summary?.missingCenters || []).length === 0 && <p className="muted">كل المراكز المطلوبة رفعت تقرير هذا الشهر.</p>}
          {(summary?.missingCenters || []).map((center) => <p key={center.id} className="muted">{center.name} - {center.location}</p>)}
        </div>
        <div className="panel">
          <h3>أحدث عمليات الرفع</h3>
          {(summary?.latestUploads || []).map((upload) => <p key={upload.id} className="muted">{upload.originalName} - {upload.month || '-'} - {upload.status} - {upload.centerName || '-'}</p>)}
        </div>
      </div>

      <div className="panel table-wrap" style={{ marginTop: 16 }}>
        <h3>إحصائيات الأشهر الأخيرة</h3>
        <table className="table">
          <thead><tr><th>الشهر</th><th>الإيرادات</th><th>المصروفات</th><th>الندوات</th><th>المراكز</th></tr></thead>
          <tbody>{(summary?.monthlyStatistics || []).map((item) => <tr key={item.month}>
            <td>{item.month}</td>
            <td>{formatMoney(item.totalRevenues)}</td>
            <td>{formatMoney(item.totalExpenses)}</td>
            <td>{item.totalSeminars}</td>
            <td>{item.uploadedCenters}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </>
  );
}
