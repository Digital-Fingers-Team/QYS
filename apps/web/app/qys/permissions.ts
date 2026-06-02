import type { Role } from './types';

export const roleOptions: Array<{ value: Role; label: string }> = [
  { value: 'USER', label: 'مستخدم' },
  { value: 'CENTER_MANAGER', label: 'مسؤول مركز' },
  { value: 'DIRECTORATE_MANAGER', label: 'مدير مديرية' }
];
export const adminRoles: Role[] = ['DIRECTORATE_MANAGER'];
export const managementRoles: Role[] = [...adminRoles, 'CENTER_MANAGER'];

export function roleLabel(role: Role) {
  return roleOptions.find((option) => option.value === role)?.label || role;
}

export function canOpenAdmin(role?: Role) {
  return canManageAccounts(role);
}

export function canManageAccounts(role?: Role) {
  return Boolean(role && adminRoles.includes(role));
}

export function canAccessReports(role?: Role) {
  return Boolean(role && managementRoles.includes(role));
}

export function canAssignRole(actorRole: Role | undefined, targetRole: Role) {
  if (actorRole === 'DIRECTORATE_MANAGER') return ['CENTER_MANAGER', 'USER'].includes(targetRole);
  return false;
}

export function roleOptionsFor(actorRole?: Role) {
  return roleOptions.filter((option) => canAssignRole(actorRole, option.value));
}

export const labels = {
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
