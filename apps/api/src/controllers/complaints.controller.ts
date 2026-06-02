import { Response } from "express";
import { complaintSchema, statusUpdateSchema } from "@qys/shared";
import { isAdminRole } from "../auth/rbac";
import { db } from "../db";
import { AuthedRequest } from "../middleware/auth";
import { idParam, paginationFrom, wantsPaginated } from "./controller-utils";

export const complaintsController = {
  list: async (req: AuthedRequest, res: Response) => {
    const userId = isAdminRole(req.user?.role) ? undefined : req.user?.userId;
    const query = paginationFrom(req);
    res.json(wantsPaginated(req) ? await db.complaints.listPage({ userId, page: query.page, pageSize: query.pageSize }) : await db.complaints.list(userId));
  },
  create: async (req: AuthedRequest, res: Response) => {
    const complaint = await db.complaints.create(complaintSchema.parse(req.body), req.user!.userId);
    await db.activities.create(`Submitted complaint ${complaint.title}`, req.user!.userId);
    res.status(201).json(complaint);
  },
  updateStatus: async (req: AuthedRequest, res: Response) => {
    const { status } = statusUpdateSchema.parse(req.body);
    const complaint = await db.complaints.updateStatus(idParam(req), status);
    await db.activities.create(`Updated complaint status to ${status}`, req.user?.userId);
    res.json(complaint);
  }
};
