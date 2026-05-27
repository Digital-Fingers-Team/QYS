export const assignableRoles = ["DIRECTORATE_MANAGER", "CENTER_MANAGER", "USER"] as const;
export type AppRole = (typeof assignableRoles)[number];
export type StoredRole = AppRole | "ADMIN" | "CENTER";

export const adminRoles: AppRole[] = ["DIRECTORATE_MANAGER"];
export const managementRoles: AppRole[] = [...adminRoles, "CENTER_MANAGER"];
export const reportRoles: AppRole[] = [...managementRoles];

const assignmentMatrix: Record<AppRole, AppRole[]> = {
  DIRECTORATE_MANAGER: ["CENTER_MANAGER", "USER"],
  CENTER_MANAGER: ["USER"],
  USER: []
};

const managementMatrix: Record<AppRole, AppRole[]> = {
  DIRECTORATE_MANAGER: ["CENTER_MANAGER", "USER"],
  CENTER_MANAGER: [],
  USER: []
};

export function normalizeRole(role?: string): AppRole {
  if (role === "ADMIN") return "DIRECTORATE_MANAGER";
  if (role === "CENTER") return "CENTER_MANAGER";
  if (assignableRoles.includes(role as AppRole)) return role as AppRole;
  return "USER";
}

export function hasRole(role: string | undefined, allowed: readonly AppRole[]) {
  return allowed.includes(normalizeRole(role));
}

export function canAssignRole(actorRole: string | undefined, targetRole: string | undefined) {
  return assignmentMatrix[normalizeRole(actorRole)].includes(normalizeRole(targetRole));
}

export function canManageAccount(actorRole: string | undefined, targetRole: string | undefined) {
  return managementMatrix[normalizeRole(actorRole)].includes(normalizeRole(targetRole));
}

export function isAdminRole(role: string | undefined) {
  return hasRole(role, adminRoles);
}
