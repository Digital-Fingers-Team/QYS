import { Response } from "express";
import { monthlyReportQuerySchema } from "@qys/shared";
import { ApiError } from "../errors/api-error";
import { AuthedRequest } from "../middleware/auth";
import { buildMonthlyReportWorkbook, buildMonthlyTemplateWorkbook } from "../services/monthly-report-export.service";
import { getExportData, listMonthlyReports, listMonthlyUploads, monthlySummary, uploadMonthlyReport } from "../services/monthly-report.service";

function monthFromQuery(req: AuthedRequest) {
  return monthlyReportQuerySchema.parse({ month: req.query.month }).month;
}

function excelResponse(res: Response, filename: string, buffer: Buffer) {
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buffer);
}

export const monthlyReportsController = {
  upload: async (req: AuthedRequest, res: Response) => {
    res.status(201).json(await uploadMonthlyReport(req));
  },
  list: async (req: AuthedRequest, res: Response) => {
    res.json(await listMonthlyReports(monthFromQuery(req), req));
  },
  summary: async (req: AuthedRequest, res: Response) => {
    res.json(await monthlySummary(monthFromQuery(req), req));
  },
  uploads: async (req: AuthedRequest, res: Response) => {
    res.json(await listMonthlyUploads(monthFromQuery(req), req));
  },
  export: async (req: AuthedRequest, res: Response) => {
    const month = monthFromQuery(req);
    const { centers, reports } = await getExportData(month);
    excelResponse(res, `monthly-report-${month}.xlsx`, await buildMonthlyReportWorkbook(month, centers, reports));
  },
  template: async (_req: AuthedRequest, res: Response) => {
    excelResponse(res, "monthly-report-template.xlsx", await buildMonthlyTemplateWorkbook());
  }
};

export function ensureFileOnRequest(req: AuthedRequest) {
  if (!req.file) throw new ApiError(400, "يرجى اختيار ملف Excel للرفع.", "FILE_REQUIRED");
}
