import { Request } from "express";
import { idParamSchema, paginationQuerySchema } from "@qys/shared";

export const idParam = (req: Request) => idParamSchema.parse(req.params).id;

export function paginationFrom(req: Request) {
  return paginationQuerySchema.parse({ page: req.query.page, pageSize: req.query.pageSize, q: req.query.q });
}

export function wantsPaginated(req: Request) {
  return req.query.page !== undefined || req.query.pageSize !== undefined;
}

export function mapPage<T, U>(
  page: { items: T[]; page: number; pageSize: number; total: number; totalPages: number },
  map: (item: T) => U
) {
  return { ...page, items: page.items.map(map) };
}
