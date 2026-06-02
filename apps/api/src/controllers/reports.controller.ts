import { Response } from "express";
import { reportSchema } from "@qys/shared";
import { db } from "../db";
import { ApiError } from "../errors/api-error";
import { AuthedRequest } from "../middleware/auth";
import { paginationFrom, wantsPaginated } from "./controller-utils";

export const reportsController = {
  list: async (req: AuthedRequest, res: Response) => {
    const centerId = req.user?.role === "CENTER_MANAGER" ? req.user.centerId : undefined;
    if (req.user?.role === "CENTER_MANAGER" && !centerId) throw new ApiError(400, "No center is linked to this account", "CENTER_REQUIRED");
    const query = paginationFrom(req);
    res.json(wantsPaginated(req) ? await db.reports.listPage({ ...(centerId ? { centerId } : {}), page: query.page, pageSize: query.pageSize }) : await db.reports.list(centerId ? { centerId } : undefined));
  },
  create: async (req: AuthedRequest, res: Response) => {
    const data = reportSchema.parse(req.body);
    const centerId = req.user?.role === "CENTER_MANAGER" ? req.user.centerId : undefined;
    if (req.user?.role === "CENTER_MANAGER" && !centerId) throw new ApiError(400, "No center is linked to this account", "CENTER_REQUIRED");
    const report = await db.reports.create({ ...data, userId: req.user!.userId, centerId });
    await db.activities.create(`Uploaded report ${report.title}`, req.user!.userId);
    res.status(201).json(report);
  }
};
