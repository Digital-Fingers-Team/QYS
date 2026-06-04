import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { centerSchema, centerUpdateSchema } from "@qys/shared";
import { db } from "../db";
import { AuthedRequest } from "../middleware/auth";
import { idParam, paginationFrom, wantsPaginated } from "./controller-utils";
import { ApiError } from "../errors/api-error";

const revealCredentialsSchema = z.object({
  password: z.string().min(1).max(128)
}).strict();

export const centersController = {
  list: async (req: Request, res: Response) => {
    const query = paginationFrom(req);
    res.json(wantsPaginated(req) ? await db.centers.listPage(query) : await db.centers.list({ q: query.q }));
  },
  metrics: async (_req: AuthedRequest, res: Response) => {
    res.json(await db.centers.metrics());
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
  revealCredentials: async (req: AuthedRequest, res: Response) => {
    const data = revealCredentialsSchema.parse(req.body);
    const actor = await db.users.findAuthById(req.user!.userId);
    if (!actor || actor.isActive === false || actor.deletedAt) throw new ApiError(401, "Account is inactive", "ACCOUNT_INACTIVE");
    const passwordOk = await bcrypt.compare(data.password, actor.passwordHash);
    if (!passwordOk) throw new ApiError(400, "كلمة مرور المدير غير صحيحة.", "CURRENT_PASSWORD_INCORRECT");

    const center = await db.centers.get(idParam(req));
    if (!center) throw new ApiError(404, "المركز غير موجود.", "CENTER_NOT_FOUND");
    const credentials = await db.users.findCenterManagerCredentials(center.id);
    if (!credentials?.password) throw new ApiError(404, "لا توجد كلمة مرور محفوظة لهذا المركز في قاعدة البيانات. أعد تشغيل seed أو أعد تعيين كلمة مرور مدير المركز.", "CENTER_CREDENTIALS_NOT_FOUND");

    await db.activities.create(`Revealed center credentials for ${center.name}`, req.user!.userId);
    res.json({ email: credentials.email, password: credentials.password });
  },
  delete: async (req: AuthedRequest, res: Response) => {
    await db.centers.delete(idParam(req));
    await db.activities.create(`Deleted center #${idParam(req)}`, req.user?.userId);
    res.status(204).send();
  }
};
