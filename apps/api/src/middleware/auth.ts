import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { adminRoles, AppRole, hasRole, normalizeRole } from "../auth/rbac";
import { env } from "../config/env";
import { db } from "../db";

type JwtPayload = { userId?: number };

export interface AuthedRequest extends Request { user?: { userId: number; role: AppRole; centerId?: number | null } }

export async function auth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ message: "Unauthorized" });
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    if (!payload.userId) return res.status(401).json({ message: "Invalid token" });
    const user = await db.users.findAuthById(payload.userId);
    if (!user || user.isActive === false) return res.status(401).json({ message: "Account is inactive" });
    req.user = { userId: user.id, role: normalizeRole(user.role), centerId: user.centerId };
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}
export async function optionalAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return next();
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    if (!payload.userId) return next();
    const user = await db.users.findAuthById(payload.userId);
    if (user && user.isActive !== false) req.user = { userId: user.id, role: normalizeRole(user.role), centerId: user.centerId };
  } catch {}
  next();
}
export const requireRole = (...roles: AppRole[]) => (req: AuthedRequest, res: Response, next: NextFunction) =>
  req.user && hasRole(req.user.role, roles) ? next() : res.status(403).json({ message: "Forbidden" });

export const requireAdmin = requireRole(...adminRoles);
