'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

type Role = 'ADMIN' | 'USER';
type User = {
  id: number;
  name: string;
  email: string;
  role: Role;
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
type Report = { id: number; title: string; type: string; content: string; status: string; date: string };

const storageKey = 'qys_session';

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
  const saved = window.localStorage.getItem(storageKey);
  return saved ? JSON.parse(saved) : null;
}

function writeSession(token: string, user: User) {
  window.localStorage.setItem(storageKey, JSON.stringify({ token, user }));
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
        window.localStorage.removeItem(storageKey);
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
    window.localStorage.removeItem(storageKey);
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

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
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
          body: JSON.stringify({ name: field(form, 'name'), email: field(form, 'email'), password: field(form, 'password') })
        });
      }
      const result = await api<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: field(form, 'email'), password: field(form, 'password') })
      });
      writeSession(result.token, result.user);
      router.replace(result.user.role === 'ADMIN' ? '/admin' : '/dashboard');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <form className="auth-card grid" onSubmit={submit}>
        <div className="brand">
          <div className="brand-mark">Q</div>
          <div>
            <h1>{mode === 'login' ? 'منصة الشباب والرياضة' : 'انضم إلى المنصة'}</h1>
            <p className="muted">القليوبية | منصة خدمات الشباب</p>
          </div>
        </div>
        {mode === 'signup' && <input className="input" name="name" placeholder="الاسم الكامل" required />}
        <input className="input" name="email" type="email" placeholder="admin@example.com" defaultValue={mode === 'login' ? 'admin@example.com' : ''} required />
        <input className="input" name="password" type="password" placeholder="admin123" defaultValue={mode === 'login' ? 'admin123' : ''} required />
        <button className="btn primary" disabled={loading}>{loading ? 'جاري التحميل...' : mode === 'login' ? 'دخول' : 'إنشاء حساب'}</button>
        {error && <p className="error">{error}</p>}
        <Link className="muted" href={mode === 'login' ? '/signup' : '/login'}>{mode === 'login' ? 'إنشاء حساب جديد' : 'لديك حساب بالفعل؟'}</Link>
      </form>
    </main>
  );
}

function Shell({ children, admin = false }: { children: React.ReactNode; admin?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, ready, logout } = useSession(true);
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
    if (admin && user.role !== 'ADMIN') router.replace('/dashboard');
  }, [admin, ready, router, user]);

  if (!ready || !user) return <main className="auth-page">جاري التحميل...</main>;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">Q</div>
          <div>
            <strong>{admin ? 'لوحة التحكم' : 'منصة الشباب'}</strong>
            <p className="muted">{user.name}</p>
          </div>
        </div>
        <nav className="nav-list">
          {nav.map(([href, text]) => (
            <Link key={href} className={`nav-link ${pathname === href ? 'active' : ''}`} href={href}>
              <span>{text}</span>
              <span>{pathname === href ? '•' : ''}</span>
            </Link>
          ))}
          {user.role === 'ADMIN' && !admin && <Link className="nav-link" href="/admin">لوحة المسؤول</Link>}
          <button className="btn danger" onClick={logout}>{t.logout}</button>
        </nav>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}

function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="topbar">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
    </div>
  );
}

function useData<T>(path: string, token?: string, initial: T | null = null) {
  const [data, setData] = useState<T | null>(initial);
  const [error, setError] = useState('');
  const load = () => api<T>(path, undefined, token).then(setData).catch((err) => setError((err as Error).message));
  useEffect(() => {
    if (token !== undefined) load();
  }, [path, token]);
  return { data, setData, error, load };
}

export function UserPage({ section }: { section: 'dashboard' | 'centers' | 'ideas' | 'challenges' | 'complaints' | 'settings' }) {
  const { token, user, setUser } = useSession(true);
  return (
    <Shell>
      {section === 'dashboard' && <UserDashboard token={token} />}
      {section === 'centers' && <CentersPage token={token} admin={false} />}
      {section === 'ideas' && <IdeasPage token={token} admin={false} />}
      {section === 'challenges' && <ChallengesPage token={token} admin={false} />}
      {section === 'complaints' && <ComplaintsPage token={token} admin={false} />}
      {section === 'settings' && user && <SettingsPage token={token} user={user} setUser={setUser} />}
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
    <div className="panel">
      <p className="muted">{title}</p>
      <h2>{value}</h2>
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
        <option>تحت الدراسة</option>
        <option>مقبولة</option>
        <option>مرفوضة</option>
      </select>}
    </article>
  );
}

function ChallengesPage({ token, admin }: { token: string; admin: boolean }) {
  const { data, load } = useData<Challenge[]>('/challenges', token, []);
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    await api('/challenges', { method: 'POST', body: JSON.stringify({ title: field(form, 'title'), description: field(form, 'description'), reward: num(form, 'reward') || 0, category: field(form, 'category'), deadline: field(form, 'deadline'), status: 'نشط' }) }, token);
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
        <option>قيد المعالجة</option>
        <option>تم الحل</option>
        <option>مرفوضة</option>
      </select>}
    </article>
  );
}

function SettingsPage({ token, user, setUser }: { token: string; user: User; setUser: (user: User) => void }) {
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const updated = await api<User>('/auth/me', { method: 'PATCH', body: JSON.stringify({ name: field(form, 'name'), avatar: field(form, 'avatar'), language: field(form, 'language'), theme: field(form, 'theme') }) }, token);
    setUser(updated);
    writeSession(token, updated);
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
    </>
  );
}

export function AdminPage({ section }: { section: 'dashboard' | 'users' | 'centers' | 'ideas' | 'challenges' | 'complaints' | 'reports' }) {
  const { token } = useSession(true);
  return (
    <Shell admin>
      {section === 'dashboard' && <AdminDashboard token={token} />}
      {section === 'users' && <UsersAdmin token={token} />}
      {section === 'centers' && <CentersPage token={token} admin />}
      {section === 'ideas' && <IdeasPage token={token} admin />}
      {section === 'challenges' && <ChallengesPage token={token} admin />}
      {section === 'complaints' && <ComplaintsPage token={token} admin />}
      {section === 'reports' && <ReportsAdmin token={token} />}
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

function UsersAdmin({ token }: { token: string }) {
  const { data, load } = useData<User[]>('/users', token, []);
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    await api('/users', { method: 'POST', body: JSON.stringify({ name: field(form, 'name'), email: field(form, 'email'), password: field(form, 'password'), role: field(form, 'role'), points: num(form, 'points') || 0, status: 'ACTIVE' }) }, token);
    form.reset();
    load();
  }
  async function remove(id: number) {
    await api(`/users/${id}`, { method: 'DELETE' }, token);
    load();
  }
  return (
    <>
      <Header title="إدارة المستخدمين" />
      <form className="panel form-grid" onSubmit={create}>
        <input className="input" name="name" placeholder="الاسم" required />
        <input className="input" name="email" type="email" placeholder="البريد" required />
        <input className="input" name="password" placeholder="كلمة المرور" required />
        <input className="input" name="points" type="number" placeholder="النقاط" />
        <select className="select" name="role"><option value="USER">USER</option><option value="ADMIN">ADMIN</option></select>
        <button className="btn primary">إضافة</button>
      </form>
      <div className="panel table-wrap" style={{ marginTop: 16 }}>
        <table className="table">
          <thead><tr><th>الاسم</th><th>البريد</th><th>الدور</th><th>النقاط</th><th></th></tr></thead>
          <tbody>{(data || []).map((user) => <tr key={user.id}><td>{user.name}</td><td>{user.email}</td><td>{user.role}</td><td>{user.points}</td><td><button className="btn danger" onClick={() => remove(user.id)}>حذف</button></td></tr>)}</tbody>
        </table>
      </div>
    </>
  );
}

function ReportsAdmin({ token }: { token: string }) {
  const { data: reports } = useData<Report[]>('/reports', token, []);
  const { data: activities } = useData<Activity[]>('/activities', token, []);
  return (
    <>
      <Header title="التقارير التحليلية" subtitle="تقارير النظام وسجل النشاطات." />
      <div className="grid cards">
        {(reports || []).map((report) => <article className="item-card" key={report.id}><h3>{report.title}</h3><p className="muted">{report.type} | {report.status}</p><p>{report.content}</p></article>)}
      </div>
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>سجل النشاطات</h3>
        {(activities || []).map((activity) => <p key={activity.id} className="muted">{activity.action} - {activity.userName || 'النظام'}</p>)}
      </div>
    </>
  );
}
