import { db } from "../db";
import { authLoginSchema, authRegisterSchema, passwordChangeSchema } from "@qys/shared";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { normalizeRole } from "../auth/rbac";
import { env } from "../config/env";
export async function register(input: unknown) {
  const data = authRegisterSchema.parse(input);
  const exists = await db.users.findByEmail(data.email);
  if (exists) throw new Error("Email exists");
  const center = await db.centers.get(data.centerId);
  if (!center) throw new Error("Center not found");
  const passwordHash = await bcrypt.hash(data.password, 10);
  const user = await db.users.create({ name: data.name, email: data.email, centerId: data.centerId, passwordHash, role: "USER", isActive: true });
  return { id: user.id, email: user.email, name: user.name, role: normalizeRole(user.role) };
}
export async function login(input: unknown) {
  const data = authLoginSchema.parse(input);
  const user = await db.users.findByEmail(data.email);
  if (!user) throw new Error("Invalid credentials");
  if (user.isActive === false) throw new Error("Account is inactive");
  const ok = await bcrypt.compare(data.password, user.passwordHash);
  if (!ok) throw new Error("Invalid credentials");
  const role = normalizeRole(user.role);
  await db.users.recordLogin(user.id);
  const token = jwt.sign({ userId: user.id }, env.JWT_SECRET, { expiresIn: "1d" });
  return {
    token,
    user: {
      id: user.id,
      role,
      name: user.name,
      email: user.email,
      centerId: user.centerId,
      isActive: true,
      points: user.points,
      status: user.status,
      avatar: user.avatar,
      language: user.language,
      theme: user.theme
    }
  };
}

export async function changePassword(userId: number, input: unknown) {
  const data = passwordChangeSchema.parse(input);
  const user = await db.users.findAuthById(userId);
  if (!user || user.isActive === false) throw new Error("Account is inactive");
  const ok = await bcrypt.compare(data.currentPassword, user.passwordHash);
  if (!ok) throw new Error("Current password is incorrect");
  await db.users.update(userId, { passwordHash: await bcrypt.hash(data.newPassword, 10) });
  return { ok: true };
}
