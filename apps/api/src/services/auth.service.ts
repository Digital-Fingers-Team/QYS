import { db } from "../db";
import { authLoginSchema, authRegisterSchema, passwordChangeSchema } from "@qys/shared";
import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import { normalizeRole } from "../auth/rbac";
import { env } from "../config/env";
import { ApiError } from "../errors/api-error";
export async function register(input: unknown) {
  const data = authRegisterSchema.parse(input);
  const exists = await db.users.findByEmail(data.email);
  if (exists) throw new ApiError(409, "Email exists", "EMAIL_EXISTS");
  const center = await db.centers.get(data.centerId);
  if (!center) throw new ApiError(404, "Center not found", "CENTER_NOT_FOUND");
  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await db.users.create({ name: data.name, email: data.email, centerId: data.centerId, passwordHash, role: "USER", isActive: true });
  return { id: user.id, email: user.email, name: user.name, role: normalizeRole(user.role) };
}
export async function login(input: unknown) {
  const data = authLoginSchema.parse(input);
  const user = await db.users.findByEmail(data.email);
  if (!user) throw new ApiError(401, "Invalid credentials", "INVALID_CREDENTIALS");
  if (user.isActive === false || user.deletedAt) throw new ApiError(401, "Account is inactive", "ACCOUNT_INACTIVE");
  const ok = await bcrypt.compare(data.password, user.passwordHash);
  if (!ok) throw new ApiError(401, "Invalid credentials", "INVALID_CREDENTIALS");
  const role = normalizeRole(user.role);
  await db.users.recordLogin(user.id);
  const token = jwt.sign({}, env.JWT_SECRET, {
    subject: String(user.id),
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
    algorithm: "HS256",
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE
  });
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
  if (!user || user.isActive === false || user.deletedAt) throw new ApiError(401, "Account is inactive", "ACCOUNT_INACTIVE");
  const ok = await bcrypt.compare(data.currentPassword, user.passwordHash);
  if (!ok) throw new ApiError(400, "Current password is incorrect", "CURRENT_PASSWORD_INCORRECT");
  await db.users.update(userId, {
    passwordHash: await bcrypt.hash(data.newPassword, 12),
    managedPassword: normalizeRole(user.role) === "CENTER_MANAGER" ? data.newPassword : undefined
  });
  return { ok: true };
}
