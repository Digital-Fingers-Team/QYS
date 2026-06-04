import { Response } from "express";
import { ideaSchema, statusUpdateSchema } from "@qys/shared";
import { z } from "zod";
import { isAdminRole } from "../auth/rbac";
import { db } from "../db";
import { ApiError } from "../errors/api-error";
import { AuthedRequest } from "../middleware/auth";
import { idParam, paginationFrom, wantsPaginated } from "./controller-utils";

const publishedIdeaStatuses = ["ACTIVE", "RESOLVED"];
const ideaVisibilitySchema = z.object({ visibleToUsers: z.boolean() }).strict();

export const ideasController = {
  list: async (req: AuthedRequest, res: Response) => {
    const query = paginationFrom(req);
    const filter =
      req.user?.role === "CENTER_MANAGER"
        ? { centerId: req.user.centerId ?? -1 }
        : req.user && isAdminRole(req.user.role)
          ? {}
          : { statuses: publishedIdeaStatuses, visibleToUsers: true };
    const voterId = req.user?.role === "USER" ? req.user.userId : undefined;
    res.json(wantsPaginated(req) ? await db.ideas.listPage({ ...filter, voterId, page: query.page, pageSize: query.pageSize }) : await db.ideas.list({ ...filter, voterId }));
  },
  create: async (req: AuthedRequest, res: Response) => {
    if (req.user?.role !== "USER") throw new ApiError(403, "Only user accounts can submit ideas.", "IDEA_SUBMIT_USER_ONLY");
    if (!req.user.centerId) throw new ApiError(400, "No center is linked to this account.", "CENTER_REQUIRED");
    const idea = await db.ideas.create(ideaSchema.parse(req.body), req.user.userId, req.user.centerId);
    await db.activities.create(`Submitted idea ${idea.title} for center review`, req.user.userId);
    res.status(201).json(idea);
  },
  vote: async (req: AuthedRequest, res: Response) => {
    if (req.user?.role !== "USER") throw new ApiError(403, "Only user accounts can vote for ideas.", "IDEA_VOTE_USER_ONLY");
    const idea = await db.ideas.vote(idParam(req), req.user.userId);
    await db.activities.create(`Voted for idea #${idParam(req)}`, req.user?.userId);
    res.json(idea);
  },
  updateStatus: async (req: AuthedRequest, res: Response) => {
    const { status } = statusUpdateSchema.parse(req.body);
    const idea = await db.ideas.updateStatus(idParam(req), status);
    await db.activities.create(`Updated idea status to ${status}`, req.user?.userId);
    res.json(idea);
  },
  updateVisibility: async (req: AuthedRequest, res: Response) => {
    const { visibleToUsers } = ideaVisibilitySchema.parse(req.body);
    const idea = await db.ideas.updateVisibility(idParam(req), visibleToUsers);
    await db.activities.create(`${visibleToUsers ? "Showed" : "Hid"} idea #${idea.id} from users`, req.user?.userId);
    res.json(idea);
  },
  updateCenterStatus: async (req: AuthedRequest, res: Response) => {
    if (req.user?.role !== "CENTER_MANAGER") throw new ApiError(403, "Only center accounts can review ideas.", "CENTER_REVIEW_REQUIRED");
    if (!req.user.centerId) throw new ApiError(400, "No center is linked to this account.", "CENTER_REQUIRED");
    const { status } = statusUpdateSchema.parse(req.body);
    const idea = await db.ideas.updateStatusForCenter(idParam(req), req.user.centerId, status);
    await db.activities.create(`Center reviewed idea #${idea.id} as ${status}`, req.user.userId);
    res.json(idea);
  }
};
