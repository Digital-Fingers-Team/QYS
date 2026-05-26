import { prisma } from "../utils/prisma";
import { authLoginSchema, authRegisterSchema } from "@qys/shared";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
export async function register(input: unknown) {
  const data = authRegisterSchema.parse(input);
  const exists = await prisma.user.findUnique({ where: { email: data.email } });
  if (exists) throw new Error("Email exists");
  const passwordHash = await bcrypt.hash(data.password, 10);
  const user = await prisma.user.create({ data: { name: data.name, email: data.email, passwordHash } });
  return { id: user.id, email: user.email, name: user.name };
}
export async function login(input: unknown) {
  const data = authLoginSchema.parse(input);
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user) throw new Error("Invalid credentials");
  const ok = await bcrypt.compare(data.password, user.passwordHash);
  if (!ok) throw new Error("Invalid credentials");
  const token = jwt.sign({ userId: user.id, role: user.role }, env.JWT_SECRET, { expiresIn: "1d" });
  return { token, user: { id: user.id, role: user.role, name: user.name, email: user.email } };
}
