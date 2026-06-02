import { Response } from "express";
import { challengeSchema, challengeUpdateSchema } from "@qys/shared";
import { db } from "../db";
import { AuthedRequest } from "../middleware/auth";
import { idParam, paginationFrom, wantsPaginated } from "./controller-utils";

export const challengesController = {
  list: async (req: AuthedRequest, res: Response) => {
    const query = paginationFrom(req);
    res.json(wantsPaginated(req) ? await db.challenges.listPage({ userId: req.user?.userId, page: query.page, pageSize: query.pageSize }) : await db.challenges.list(req.user?.userId));
  },
  get: async (req: AuthedRequest, res: Response) => {
    const challenge = await db.challenges.get(idParam(req), req.user?.userId);
    if (!challenge) return res.status(404).json({ message: "Challenge not found" });
    res.json(challenge);
  },
  create: async (req: AuthedRequest, res: Response) => {
    const challenge = await db.challenges.create(challengeSchema.parse(req.body));
    await db.activities.create(`Created challenge ${challenge.title}`, req.user?.userId);
    res.status(201).json(challenge);
  },
  update: async (req: AuthedRequest, res: Response) => {
    const challenge = await db.challenges.update(idParam(req), challengeUpdateSchema.parse(req.body));
    await db.activities.create(`Updated challenge ${challenge.title}`, req.user?.userId);
    res.json(challenge);
  },
  delete: async (req: AuthedRequest, res: Response) => {
    await db.challenges.delete(idParam(req));
    await db.activities.create(`Deleted challenge #${idParam(req)}`, req.user?.userId);
    res.status(204).send();
  },
  join: async (req: AuthedRequest, res: Response) => {
    const participation = await db.challenges.join(idParam(req), req.user!.userId);
    await db.activities.create(`Joined challenge #${idParam(req)}`, req.user!.userId);
    res.status(201).json(participation);
  }
};
