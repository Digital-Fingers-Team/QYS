import { Request, Response } from "express";
import { ideaSchema, statusUpdateSchema } from "@qys/shared";
import { db } from "../db";
import { AuthedRequest } from "../middleware/auth";
import { idParam, paginationFrom, wantsPaginated } from "./controller-utils";

export const ideasController = {
  list: async (req: Request, res: Response) => {
    const query = paginationFrom(req);
    res.json(wantsPaginated(req) ? await db.ideas.listPage({ page: query.page, pageSize: query.pageSize }) : await db.ideas.list());
  },
  create: async (req: AuthedRequest, res: Response) => {
    const idea = await db.ideas.create(ideaSchema.parse(req.body), req.user!.userId);
    await db.activities.create(`Submitted idea ${idea.title}`, req.user!.userId);
    res.status(201).json(idea);
  },
  vote: async (req: AuthedRequest, res: Response) => {
    const idea = await db.ideas.vote(idParam(req));
    await db.activities.create(`Voted for idea #${idParam(req)}`, req.user?.userId);
    res.json(idea);
  },
  updateStatus: async (req: AuthedRequest, res: Response) => {
    const { status } = statusUpdateSchema.parse(req.body);
    const idea = await db.ideas.updateStatus(idParam(req), status);
    await db.activities.create(`Updated idea status to ${status}`, req.user?.userId);
    res.json(idea);
  }
};
