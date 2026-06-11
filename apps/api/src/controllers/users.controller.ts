import { Response } from "express";
import bcrypt from "bcryptjs";
import { passwordResetSchema, userAdminSchema, userAdminUpdateSchema } from "@qys/shared";
import { canAssignRole, canManageAccount, normalizeRole } from "../auth/rbac";
import { db } from "../db";
import { ApiError } from "../errors/api-error";
import { AuthedRequest } from "../middleware/auth";
import { idParam, mapPage, paginationFrom, wantsPaginated } from "./controller-utils";
import { publicUser } from "./user-presenter";

async function hashPassword(password?: string) {
  return password ? bcrypt.hash(password, 12) : undefined;
}

function assertSafeUserRole(req: AuthedRequest, role?: string, centerId?: number | null) {
  const normalizedRole = normalizeRole(role);
  if (!canAssignRole(req.user?.role, normalizedRole)) throw new ApiError(403, "You cannot assign this role", "ROLE_ASSIGNMENT_DENIED");
  if (normalizedRole === "CENTER_MANAGER" && !centerId) throw new ApiError(400, "Center manager accounts require a center", "CENTER_REQUIRED");
}

async function assertCenterExists(centerId?: number | null) {
  if (!centerId) return;
  const center = await db.centers.get(centerId);
  if (!center) throw new ApiError(404, "Center not found", "CENTER_NOT_FOUND");
}

async function assertCanManageAccount(req: AuthedRequest, targetId: number) {
  const target = await db.users.findById(targetId);
  if (!target) throw new ApiError(404, "User not found", "USER_NOT_FOUND");
  if (!canManageAccount(req.user?.role, target.role)) throw new ApiError(403, "You cannot manage this account", "ACCOUNT_MANAGEMENT_DENIED");
  return target;
}

export const usersController = {
  list: async (req: AuthedRequest, res: Response) => {
    const centerId = req.user?.role === "CENTER_MANAGER" ? req.user.centerId : undefined;
    if (req.user?.role === "CENTER_MANAGER" && !centerId) throw new ApiError(400, "No center is linked to this account", "CENTER_REQUIRED");
    const query = paginationFrom(req);
    const filter = { ...(centerId ? { centerId } : {}), q: query.q, role: query.role };
    res.json(wantsPaginated(req) ? mapPage(await db.users.listPage({ ...filter, page: query.page, pageSize: query.pageSize }), publicUser) : (await db.users.list(filter)).map(publicUser));
  },
  create: async (req: AuthedRequest, res: Response) => {
    const parsed = userAdminSchema.parse(req.body);
    const data = req.user?.role === "CENTER_MANAGER"
      ? { ...parsed, role: "USER" as const, centerId: req.user.centerId, isActive: true, status: "ACTIVE" }
      : parsed;
    if (req.user?.role === "CENTER_MANAGER" && !data.centerId) throw new ApiError(400, "No center is linked to this account", "CENTER_REQUIRED");
    assertSafeUserRole(req, data.role, data.centerId);
    await assertCenterExists(data.centerId);
    const { password, ...rest } = data;
    const user = await db.users.create({
      ...rest,
      createdBy: req.user!.userId,
      passwordHash: await bcrypt.hash(password, 12),
      managedPassword: normalizeRole(data.role) === "CENTER_MANAGER" ? password : undefined
    });
    await db.activities.create(`Created account #${user.id}`, req.user!.userId);
    res.status(201).json(publicUser(user));
  },
  update: async (req: AuthedRequest, res: Response) => {
    const target = await assertCanManageAccount(req, idParam(req));
    const data = userAdminUpdateSchema.parse(req.body);
    const finalRole = data.role ?? target.role;
    const finalCenterId = data.centerId !== undefined ? data.centerId : target.centerId;
    if (data.role || data.centerId !== undefined) assertSafeUserRole(req, finalRole, finalCenterId);
    await assertCenterExists(data.centerId);
    if (idParam(req) === req.user!.userId && data.isActive === false) throw new ApiError(400, "You cannot deactivate your own account", "SELF_DEACTIVATION_DENIED");
    const passwordHash = await hashPassword(data.password);
    const { password: _password, ...rest } = data;
    const managedPassword = data.password && normalizeRole(finalRole) === "CENTER_MANAGER"
      ? data.password
      : data.role && normalizeRole(finalRole) !== "CENTER_MANAGER"
        ? null
        : undefined;
    const user = await db.users.update(idParam(req), { ...rest, passwordHash, managedPassword });
    await db.activities.create(`Updated account #${user.id}`, req.user!.userId);
    res.json(publicUser(user));
  },
  resetPassword: async (req: AuthedRequest, res: Response) => {
    const target = await assertCanManageAccount(req, idParam(req));
    const { password } = passwordResetSchema.parse(req.body);
    const user = await db.users.update(idParam(req), {
      passwordHash: await bcrypt.hash(password, 12),
      managedPassword: normalizeRole(target.role) === "CENTER_MANAGER" ? password : undefined
    });
    await db.activities.create(`Reset password for account #${user.id}`, req.user!.userId);
    res.json(publicUser(user));
  },
  delete: async (req: AuthedRequest, res: Response) => {
    await assertCanManageAccount(req, idParam(req));
    if (idParam(req) === req.user!.userId) throw new ApiError(400, "You cannot deactivate your own account", "SELF_DEACTIVATION_DENIED");
    const user = await db.users.delete(idParam(req), req.user!.userId);
    await db.activities.create(`Deactivated account ${user.email}`, req.user!.userId);
    res.json(publicUser(user));
  }
};
