import { Request, Response } from "express";
import { db } from "../db";
import { paginationFrom, wantsPaginated } from "./controller-utils";

export const activitiesController = {
  list: async (req: Request, res: Response) => {
    const query = paginationFrom(req);
    res.json(wantsPaginated(req) ? await db.activities.listPage({ page: query.page, pageSize: query.pageSize }) : await db.activities.list());
  }
};
