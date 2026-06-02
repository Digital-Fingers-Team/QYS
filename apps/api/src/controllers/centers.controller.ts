import { Request, Response } from "express";
import { centerSchema, centerUpdateSchema } from "@qys/shared";
import { db } from "../db";
import { AuthedRequest } from "../middleware/auth";
import { idParam, paginationFrom, wantsPaginated } from "./controller-utils";

export const centersController = {
  list: async (req: Request, res: Response) => {
    const query = paginationFrom(req);
    res.json(wantsPaginated(req) ? await db.centers.listPage(query) : await db.centers.list({ q: query.q }));
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
  delete: async (req: AuthedRequest, res: Response) => {
    await db.centers.delete(idParam(req));
    await db.activities.create(`Deleted center #${idParam(req)}`, req.user?.userId);
    res.status(204).send();
  }
};
