import { Response } from "express";
import { complaintSchema, statusUpdateSchema } from "@qys/shared";
import { z } from "zod";
import { isAdminRole } from "../auth/rbac";
import { db } from "../db";
import { ApiError } from "../errors/api-error";
import { AuthedRequest } from "../middleware/auth";
import { idParam, paginationFrom, wantsPaginated } from "./controller-utils";

const complaintProgressSchema = z
  .object({
    status: z.enum(["PENDING", "RESOLVED", "REJECTED"]).optional(),
    showProgress: z.boolean().optional()
  })
  .strict()
  .refine((data) => data.status !== undefined || data.showProgress !== undefined, "At least one progress field is required.");

export const complaintsController = {
  list: async (req: AuthedRequest, res: Response) => {
    const query = paginationFrom(req);
    const filter =
      req.user?.role === "CENTER_MANAGER"
        ? { centerId: req.user.centerId ?? -1 }
        : isAdminRole(req.user?.role)
          ? {}
          : { userId: req.user?.userId, visibleToUser: true };
    res.json(wantsPaginated(req) ? await db.complaints.listPage({ ...filter, page: query.page, pageSize: query.pageSize }) : await db.complaints.list(filter));
  },
  create: async (req: AuthedRequest, res: Response) => {
    const user = req.user;
    if (user?.role !== "USER") throw new ApiError(403, "Only user accounts can submit complaints.", "COMPLAINT_SUBMIT_USER_ONLY");
    if (!user.centerId) throw new ApiError(400, "No center is linked to this account.", "CENTER_REQUIRED");
    const complaint = await db.complaints.create(complaintSchema.parse(req.body), user.userId, user.centerId);
    await db.activities.create(`Submitted complaint ${complaint.title} for center review`, user.userId);
    res.status(201).json(complaint);
  },
  updateStatus: async (req: AuthedRequest, res: Response) => {
    const { status } = statusUpdateSchema.parse(req.body);
    const complaint = await db.complaints.updateStatus(idParam(req), status);
    await db.activities.create(`Updated complaint status to ${status}`, req.user?.userId);
    res.json(complaint);
  },
  updateCenterStatus: async (req: AuthedRequest, res: Response) => {
    const user = req.user;
    if (!user || (user.role !== "CENTER_MANAGER" && !isAdminRole(user.role))) throw new ApiError(403, "Only center or admin accounts can review complaints.", "CENTER_REVIEW_REQUIRED");
    if (user.role === "CENTER_MANAGER" && !user.centerId) throw new ApiError(400, "No center is linked to this account.", "CENTER_REQUIRED");
    const { status } = statusUpdateSchema.parse(req.body);
    const centerId = user.role === "CENTER_MANAGER" ? user.centerId : undefined;
    const complaint = user.role === "CENTER_MANAGER"
      ? await db.complaints.updateCenterReviewStatus(idParam(req), centerId!, status)
      : await db.complaints.updateReviewStatus(idParam(req), status);
    await db.activities.create(`Reviewed complaint #${complaint.id} as ${status}`, user.userId);
    res.json(complaint);
  },
  updateProgress: async (req: AuthedRequest, res: Response) => {
    const user = req.user;
    if (!user || (user.role !== "CENTER_MANAGER" && !isAdminRole(user.role))) throw new ApiError(403, "Only center or admin accounts can update complaint progress.", "COMPLAINT_PROGRESS_FORBIDDEN");
    if (user.role === "CENTER_MANAGER" && !user.centerId) throw new ApiError(400, "No center is linked to this account.", "CENTER_REQUIRED");
    const data = complaintProgressSchema.parse(req.body);
    const centerId = user.role === "CENTER_MANAGER" ? user.centerId : undefined;
    const complaint = await db.complaints.updateProgress(idParam(req), data, centerId);
    await db.activities.create(`Updated complaint #${complaint.id} progress`, user.userId);
    res.json(complaint);
  }
};
