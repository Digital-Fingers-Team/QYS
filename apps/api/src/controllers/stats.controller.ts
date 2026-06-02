import { Request, Response } from "express";
import { db } from "../db";
import { AuthedRequest } from "../middleware/auth";

export const statsController = {
  admin: async (_: Request, res: Response) => res.json(await db.stats.admin()),
  me: async (req: AuthedRequest, res: Response) => res.json(await db.stats.me(req.user!.userId))
};
