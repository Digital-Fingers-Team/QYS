import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
export interface AuthedRequest extends Request { user?: { userId: number; role: "ADMIN" | "USER" } }
export function auth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ message: "Unauthorized" });
  try { req.user = jwt.verify(token, env.JWT_SECRET) as any; next(); } catch { return res.status(401).json({ message: "Invalid token" }); }
}
export const requireAdmin = (req: AuthedRequest, res: Response, next: NextFunction) => req.user?.role === "ADMIN" ? next() : res.status(403).json({ message: "Forbidden" });
