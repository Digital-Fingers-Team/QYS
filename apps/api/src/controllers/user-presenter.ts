import { normalizeRole } from "../auth/rbac";

export function publicUser<T extends { role: string; isActive?: boolean }>(user: T) {
  return { ...user, role: normalizeRole(user.role), isActive: user.isActive !== false };
}
