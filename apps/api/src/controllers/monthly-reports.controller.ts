import { Response } from "express";
import { monthlyReportQuerySchema, paginationQuerySchema } from "@qys/shared";
import { ApiError } from "../errors/api-error";
import { AuthedRequest } from "../middleware/auth";
import { buildMonthlyReportWorkbook, buildMonthlyTemplateWorkbook } from "../services/monthly-report-export.service";
import { getExportData, listMonthlyReports, listMonthlyUploads, monthlySummary, uploadMonthlyReport } from "../services/monthly-report.service";

function monthFromQuery(req: AuthedRequest) {
  return monthlyReportQuerySchema.parse({ month: req.query.month }).month;
}

function paginationFromQuery(req: AuthedRequest) {
  return paginationQuerySchema.parse({ page: req.query.page, pageSize: req.query.pageSize });
}

function wantsPaginated(req: AuthedRequest) {
  return req.query.page !== undefined || req.query.pageSize !== undefined;
}

function excelResponse(res: Response, filename: string, buffer: Buffer) {
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buffer);
}

function currentMonthValue() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function optionalMonthFromQuery(req: AuthedRequest) {
  if (typeof req.query.month !== "string" || !req.query.month) return currentMonthValue();
  return monthFromQuery(req);
}

export const monthlyReportsController = {
  upload: async (req: AuthedRequest, res: Response) => {
    res.status(201).json(await uploadMonthlyReport(req));
  },
  list: async (req: AuthedRequest, res: Response) => {
    res.json(await listMonthlyReports(monthFromQuery(req), req, wantsPaginated(req) ? paginationFromQuery(req) : undefined));
  },
  summary: async (req: AuthedRequest, res: Response) => {
    res.json(await monthlySummary(monthFromQuery(req), req, paginationFromQuery(req)));
  },
  uploads: async (req: AuthedRequest, res: Response) => {
    res.json(await listMonthlyUploads(monthFromQuery(req), req, wantsPaginated(req) ? paginationFromQuery(req) : undefined));
  },
  export: async (req: AuthedRequest, res: Response) => {
    const month = monthFromQuery(req);
    const { centers, reports } = await getExportData(month);
    excelResponse(res, `monthly-report-${month}.xlsx`, await buildMonthlyReportWorkbook(month, centers, reports));
  },
  template: async (req: AuthedRequest, res: Response) => {
    const month = optionalMonthFromQuery(req);
    excelResponse(res, `monthly-report-template-${month}.xlsx`, await buildMonthlyTemplateWorkbook(month));
  }
};

export function ensureFileOnRequest(req: AuthedRequest) {
  if (!req.file) throw new ApiError(400, "يرجى اختيار ملف Excel للرفع.", "FILE_REQUIRED");
}
