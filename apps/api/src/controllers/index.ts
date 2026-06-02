import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db";
import { changePassword, login, register } from "../services/auth.service";
import {
  centerSchema,
  centerUpdateSchema,
  challengeSchema,
  challengeUpdateSchema,
  complaintSchema,
  idParamSchema,
  ideaSchema,
  paginationQuerySchema,
  passwordResetSchema,
  profileUpdateSchema,
  reportSchema,
  statusUpdateSchema,
  userAdminSchema,
  userAdminUpdateSchema
} from "@qys/shared";
import { canAssignRole, canManageAccount, isAdminRole, normalizeRole } from "../auth/rbac";
import { AuthedRequest } from "../middleware/auth";
import { ApiError } from "../errors/api-error";

const idParam = (req: Request) => idParamSchema.parse(req.params).id;

function paginationFrom(req: Request) {
  return paginationQuerySchema.parse({ page: req.query.page, pageSize: req.query.pageSize, q: req.query.q });
}

function wantsPaginated(req: Request) {
  return req.query.page !== undefined || req.query.pageSize !== undefined;
}

function mapPage<T, U>(page: { items: T[]; page: number; pageSize: number; total: number; totalPages: number }, map: (item: T) => U) {
  return { ...page, items: page.items.map(map) };
}

async function hashPassword(password?: string) {
  return password ? bcrypt.hash(password, 12) : undefined;
}

function publicUser<T extends { role: string; isActive?: boolean }>(user: T) {
  return { ...user, role: normalizeRole(user.role), isActive: user.isActive !== false };
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

export const authController = {
  register: async (req: Request, res: Response) => res.status(201).json(await register(req.body)),
  login: async (req: Request, res: Response) => res.json(await login(req.body)),
  me: async (req: AuthedRequest, res: Response) => {
    const user = await db.users.findById(req.user!.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(publicUser(user));
  },
  updateMe: async (req: AuthedRequest, res: Response) => {
    const user = await db.users.update(req.user!.userId, profileUpdateSchema.parse(req.body));
    await db.activities.create("Updated profile settings", req.user!.userId);
    res.json(publicUser(user));
  },
  changePassword: async (req: AuthedRequest, res: Response) => res.json(await changePassword(req.user!.userId, req.body))
};

export const usersController = {
  list: async (req: AuthedRequest, res: Response) => {
    const centerId = req.user?.role === "CENTER_MANAGER" ? req.user.centerId : undefined;
    if (req.user?.role === "CENTER_MANAGER" && !centerId) throw new ApiError(400, "No center is linked to this account", "CENTER_REQUIRED");
    const query = paginationFrom(req);
    const filter = { ...(centerId ? { centerId } : {}), q: query.q };
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
    const user = await db.users.create({ ...rest, createdBy: req.user!.userId, passwordHash: await bcrypt.hash(password, 12) });
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
    const user = await db.users.update(idParam(req), { ...rest, passwordHash });
    await db.activities.create(`Updated account #${user.id}`, req.user!.userId);
    res.json(publicUser(user));
  },
  resetPassword: async (req: AuthedRequest, res: Response) => {
    await assertCanManageAccount(req, idParam(req));
    const { password } = passwordResetSchema.parse(req.body);
    const user = await db.users.update(idParam(req), { passwordHash: await bcrypt.hash(password, 12) });
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

export const centersController = {
  list: async (req: Request, res: Response) => {
    const query = paginationFrom(req);
    res.json(wantsPaginated(req) ? await db.centers.listPage(query) : await db.centers.list({ q: query.q }));
  },
  get: async (req: Request, res: Response) => {
    const center = await db.centers.get(idParam(req));
    if (!center) return res.status(404).json({ message: "Center not found" });
    res.json(center);
  },
  create: async (req: AuthedRequest, res: Response) => {
    const center = await db.centers.create(centerSchema.parse(req.body));
    await db.activities.create(`Created center ${center.name}`, req.user?.userId);
    res.status(201).json(center);
  },
  update: async (req: AuthedRequest, res: Response) => {
    const center = await db.centers.update(idParam(req), centerUpdateSchema.parse(req.body));
    await db.activities.create(`Updated center ${center.name}`, req.user?.userId);
    res.json(center);
  },
  delete: async (req: AuthedRequest, res: Response) => {
    await db.centers.delete(idParam(req));
    await db.activities.create(`Deleted center #${idParam(req)}`, req.user?.userId);
    res.status(204).send();
  }
};

export const challengesController = {
  list: async (req: AuthedRequest, res: Response) => {
    const query = paginationFrom(req);
    res.json(wantsPaginated(req) ? await db.challenges.listPage({ userId: req.user?.userId, page: query.page, pageSize: query.pageSize }) : await db.challenges.list(req.user?.userId));
  },
  get: async (req: AuthedRequest, res: Response) => {
    const challenge = await db.challenges.get(idParam(req), req.user?.userId);
    if (!challenge) return res.status(404).json({ message: "Challenge not found" });
    res.json(challenge);
  },
  create: async (req: AuthedRequest, res: Response) => {
    const challenge = await db.challenges.create(challengeSchema.parse(req.body));
    await db.activities.create(`Created challenge ${challenge.title}`, req.user?.userId);
    res.status(201).json(challenge);
  },
  update: async (req: AuthedRequest, res: Response) => {
    const challenge = await db.challenges.update(idParam(req), challengeUpdateSchema.parse(req.body));
    await db.activities.create(`Updated challenge ${challenge.title}`, req.user?.userId);
    res.json(challenge);
  },
  delete: async (req: AuthedRequest, res: Response) => {
    await db.challenges.delete(idParam(req));
    await db.activities.create(`Deleted challenge #${idParam(req)}`, req.user?.userId);
    res.status(204).send();
  },
  join: async (req: AuthedRequest, res: Response) => {
    const participation = await db.challenges.join(idParam(req), req.user!.userId);
    await db.activities.create(`Joined challenge #${idParam(req)}`, req.user!.userId);
    res.status(201).json(participation);
  }
};

export const ideasController = {
  list: async (req: Request, res: Response) => {
    const query = paginationFrom(req);
    res.json(wantsPaginated(req) ? await db.ideas.listPage({ page: query.page, pageSize: query.pageSize }) : await db.ideas.list());
  },
  create: async (req: AuthedRequest, res: Response) => {
    const idea = await db.ideas.create(ideaSchema.parse(req.body), req.user!.userId);
    await db.activities.create(`Submitted idea ${idea.title}`, req.user!.userId);
    res.status(201).json(idea);
  },
  vote: async (req: AuthedRequest, res: Response) => {
    const idea = await db.ideas.vote(idParam(req));
    await db.activities.create(`Voted for idea #${idParam(req)}`, req.user?.userId);
    res.json(idea);
  },
  updateStatus: async (req: AuthedRequest, res: Response) => {
    const { status } = statusUpdateSchema.parse(req.body);
    const idea = await db.ideas.updateStatus(idParam(req), status);
    await db.activities.create(`Updated idea status to ${status}`, req.user?.userId);
    res.json(idea);
  }
};

export const complaintsController = {
  list: async (req: AuthedRequest, res: Response) => {
    const userId = isAdminRole(req.user?.role) ? undefined : req.user?.userId;
    const query = paginationFrom(req);
    res.json(wantsPaginated(req) ? await db.complaints.listPage({ userId, page: query.page, pageSize: query.pageSize }) : await db.complaints.list(userId));
  },
  create: async (req: AuthedRequest, res: Response) => {
    const complaint = await db.complaints.create(complaintSchema.parse(req.body), req.user!.userId);
    await db.activities.create(`Submitted complaint ${complaint.title}`, req.user!.userId);
    res.status(201).json(complaint);
  },
  updateStatus: async (req: AuthedRequest, res: Response) => {
    const { status } = statusUpdateSchema.parse(req.body);
    const complaint = await db.complaints.updateStatus(idParam(req), status);
    await db.activities.create(`Updated complaint status to ${status}`, req.user?.userId);
    res.json(complaint);
  }
};

export const reportsController = {
  list: async (req: AuthedRequest, res: Response) => {
    const centerId = req.user?.role === "CENTER_MANAGER" ? req.user.centerId : undefined;
    if (req.user?.role === "CENTER_MANAGER" && !centerId) throw new ApiError(400, "No center is linked to this account", "CENTER_REQUIRED");
    const query = paginationFrom(req);
    res.json(wantsPaginated(req) ? await db.reports.listPage({ ...(centerId ? { centerId } : {}), page: query.page, pageSize: query.pageSize }) : await db.reports.list(centerId ? { centerId } : undefined));
  },
  create: async (req: AuthedRequest, res: Response) => {
    const data = reportSchema.parse(req.body);
    const centerId = req.user?.role === "CENTER_MANAGER" ? req.user.centerId : undefined;
    if (req.user?.role === "CENTER_MANAGER" && !centerId) throw new ApiError(400, "No center is linked to this account", "CENTER_REQUIRED");
    const report = await db.reports.create({ ...data, userId: req.user!.userId, centerId });
    await db.activities.create(`Uploaded report ${report.title}`, req.user!.userId);
    res.status(201).json(report);
  }
};

export const activitiesController = {
  list: async (req: Request, res: Response) => {
    const query = paginationFrom(req);
    res.json(wantsPaginated(req) ? await db.activities.listPage({ page: query.page, pageSize: query.pageSize }) : await db.activities.list());
  }
};

export const statsController = {
  admin: async (_: Request, res: Response) => res.json(await db.stats.admin()),
  me: async (req: AuthedRequest, res: Response) => res.json(await db.stats.me(req.user!.userId))
};
