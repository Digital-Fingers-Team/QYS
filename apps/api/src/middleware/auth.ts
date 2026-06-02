import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { adminRoles, AppRole, hasRole, normalizeRole } from "../auth/rbac";
import { env } from "../config/env";
import { db } from "../db";

export interface AuthedRequest extends Request { user?: { userId: number; role: AppRole; centerId?: number | null } }

function bearerToken(req: Request) {
  const authorization = req.headers.authorization;
  if (!authorization) return undefined;
  const match = authorization.match(/^Bearer ([A-Za-z0-9._~-]+)$/);
  return match?.[1];
}

function verifyToken(token: string) {
  const payload = jwt.verify(token, env.JWT_SECRET, {
    algorithms: ["HS256"],
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE
  });
  if (!payload || typeof payload === "string") return undefined;
  const userId = Number(payload.sub);
  if (!Number.isInteger(userId) || userId <= 0) return undefined;
  return { userId };
}

export async function auth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = bearerToken(req);
  if (!token) return res.status(401).json({ message: "Unauthorized" });
  try {
    const payload = verifyToken(token);
    if (!payload?.userId) return res.status(401).json({ message: "Invalid token" });
    const user = await db.users.findAuthById(payload.userId);
    if (!user || user.isActive === false) return res.status(401).json({ message: "Account is inactive" });
    req.user = { userId: user.id, role: normalizeRole(user.role), centerId: user.centerId };
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}
export async function optionalAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  const token = bearerToken(req);
  if (!token) return next();
  try {
    const payload = verifyToken(token);
    if (!payload?.userId) return next();
    const user = await db.users.findAuthById(payload.userId);
    if (user && user.isActive !== false) req.user = { userId: user.id, role: normalizeRole(user.role), centerId: user.centerId };
  } catch {}
  next();
}
export const requireRole = (...roles: AppRole[]) => (req: AuthedRequest, res: Response, next: NextFunction) =>
  req.user && hasRole(req.user.role, roles) ? next() : res.status(403).json({ message: "Forbidden" });

export const requireAdmin = requireRole(...adminRoles);
