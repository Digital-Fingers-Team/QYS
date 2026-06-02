import { Request, Response } from "express";
import { profileUpdateSchema } from "@qys/shared";
import { db } from "../db";
import { changePassword, login, register } from "../services/auth.service";
import { AuthedRequest } from "../middleware/auth";
import { ApiError } from "../errors/api-error";
import { publicUser } from "./user-presenter";

export const authController = {
  register: async (req: Request, res: Response) => res.status(201).json(await register(req.body)),
  login: async (req: Request, res: Response) => res.json(await login(req.body)),
  me: async (req: AuthedRequest, res: Response) => {
    const user = await db.users.findById(req.user!.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(publicUser(user));
  },
  updateMe: async (req: AuthedRequest, res: Response) => {
    const data = profileUpdateSchema.parse(req.body);
    if (data.email) {
      const existing = await db.users.findByEmail(data.email);
      if (existing && existing.id !== req.user!.userId) throw new ApiError(409, "Email exists", "EMAIL_EXISTS");
    }
    const user = await db.users.update(req.user!.userId, data);
    await db.activities.create("Updated profile settings", req.user!.userId);
    res.json(publicUser(user));
  },
  changePassword: async (req: AuthedRequest, res: Response) => res.json(await changePassword(req.user!.userId, req.body))
};
