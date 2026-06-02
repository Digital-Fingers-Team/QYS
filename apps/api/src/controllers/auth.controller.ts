import { Request, Response } from "express";
import { profileUpdateSchema } from "@qys/shared";
import { db } from "../db";
import { changePassword, login, register } from "../services/auth.service";
import { AuthedRequest } from "../middleware/auth";
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
    const user = await db.users.update(req.user!.userId, profileUpdateSchema.parse(req.body));
    await db.activities.create("Updated profile settings", req.user!.userId);
    res.json(publicUser(user));
  },
  changePassword: async (req: AuthedRequest, res: Response) => res.json(await changePassword(req.user!.userId, req.body))
};
