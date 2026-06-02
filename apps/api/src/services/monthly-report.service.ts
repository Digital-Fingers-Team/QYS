import path from "path";
import { monthlyReportUploadBodySchema, MonthlyReportsSummary, PaginationQueryInput } from "@qys/shared";
import { adminRoles } from "../auth/rbac";
import { db, CenterRecord } from "../db";
import { ApiError } from "../errors/api-error";
import { AuthedRequest } from "../middleware/auth";
import { parseMonthlyReportExcel } from "./excel-parser.service";
import { sanitizeOriginalFilename, safeStoredFilename, fileHash, validateExcelFile } from "./excel-upload.service";

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase("ar-EG");
}

function canManageAll(req: AuthedRequest) {
  return Boolean(req.user && adminRoles.includes(req.user.role));
}

async function resolveTargetCenter(req: AuthedRequest, centerIdFromBody?: number) {
  const user = req.user!;
  const centerId = canManageAll(req) ? centerIdFromBody : user.centerId;
  if (!centerId) {
    throw new ApiError(400, canManageAll(req) ? "يرجى اختيار المركز قبل رفع الملف." : "لا يوجد مركز مرتبط بهذا الحساب.", "CENTER_REQUIRED");
  }
  const center = await db.centers.get(centerId);
  if (!center) throw new ApiError(404, "المركز غير موجود.", "CENTER_NOT_FOUND");
  return center;
}

function baseFileMetadata(file: Express.Multer.File, status: string, userId?: number, error?: string) {
  return {
    originalName: sanitizeOriginalFilename(file.originalname),
    storedName: safeStoredFilename(),
    size: file.size,
    mimeType: file.mimetype,
    extension: path.extname(file.originalname).toLowerCase(),
    hash: fileHash(file.buffer),
    status,
    uploadedBy: userId,
    error
  };
}

async function markRejected(file: Express.Multer.File, userId: number | undefined, message: string, centerId?: number, month?: string) {
  const upload = await db.uploadedFiles.create({ ...baseFileMetadata(file, "REJECTED", userId, message), centerId, month });
  await db.uploadHistory.create({ action: "REJECTED", centerId, month, uploadedFileId: upload.id, userId, message });
  return upload;
}

export async function uploadMonthlyReport(req: AuthedRequest) {
  const file = req.file;
  if (!file) throw new ApiError(400, "يرجى اختيار ملف Excel للرفع.", "FILE_REQUIRED");
  const userId = req.user?.userId;
  const body = monthlyReportUploadBodySchema.parse(req.body);
  const targetCenter = await resolveTargetCenter(req, body.centerId);

  try {
    validateExcelFile(file);
  } catch (error) {
    const message = error instanceof Error ? error.message : "ملف غير صالح.";
    await markRejected(file, userId, message, targetCenter.id);
    throw error;
  }

  let parsed;
  try {
    parsed = await parseMonthlyReportExcel(file.buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر قراءة الملف.";
    await markRejected(file, userId, message, targetCenter.id);
    throw error;
  }

  if (normalizeText(parsed.centerName) !== normalizeText(targetCenter.name)) {
    const message = "اسم المركز داخل الملف لا يطابق المركز المختار في النظام.";
    await markRejected(file, userId, message, targetCenter.id, parsed.month);
    throw new ApiError(400, message, "CENTER_NAME_MISMATCH");
  }

  const existing = await db.monthlyReports.findByCenterMonth(targetCenter.id, parsed.month);
  if (existing && !body.replace) {
    const upload = await db.uploadedFiles.create({
      ...baseFileMetadata(file, "DUPLICATE", userId, "يوجد تقرير مرفوع لهذا المركز في نفس الشهر."),
      centerId: targetCenter.id,
      month: parsed.month
    });
    await db.uploadHistory.create({
      action: "DUPLICATE",
      centerId: targetCenter.id,
      month: parsed.month,
      uploadedFileId: upload.id,
      reportId: existing.id,
      userId,
      message: "Duplicate monthly report upload"
    });
    throw new ApiError(409, "يوجد تقرير مرفوع لهذا المركز في نفس الشهر. يمكنك الاستبدال بعد التأكيد.", "DUPLICATE_REPORT", { centerId: targetCenter.id, month: parsed.month });
  }

  const upload = await db.uploadedFiles.create({
    ...baseFileMetadata(file, existing ? "REPLACED" : "ACCEPTED", userId),
    centerId: targetCenter.id,
    month: parsed.month
  });
  const payload = {
    centerId: targetCenter.id,
    month: parsed.month,
    revenues: parsed.revenues,
    expenses: parsed.expenses,
    seminarsCount: parsed.seminarsCount,
    uploadedBy: userId,
    uploadedFileId: upload.id
  };
  const report = existing ? await db.monthlyReports.replace(existing.id, payload) : await db.monthlyReports.create(payload);
  await db.uploadHistory.create({
    action: existing ? "REPLACED" : "ACCEPTED",
    centerId: targetCenter.id,
    month: parsed.month,
    uploadedFileId: upload.id,
    reportId: report.id,
    userId,
    message: existing ? "Monthly report replaced" : "Monthly report accepted"
  });
  await db.activities.create(`${existing ? "Replaced" : "Uploaded"} monthly report ${targetCenter.name} ${parsed.month}`, userId);

  return {
    report: {
      id: report.id,
      centerId: report.centerId,
      centerName: targetCenter.name,
      month: report.month,
      revenues: report.revenues,
      expenses: report.expenses,
      seminarsCount: report.seminarsCount,
      uploadedBy: report.uploadedBy,
      uploadedAt: report.updatedAt,
      sourceFileName: upload.originalName
    },
    upload: { ...upload, centerName: targetCenter.name },
    replaced: Boolean(existing),
    message: existing ? "تم استبدال التقرير الشهري بنجاح." : "تم رفع التقرير الشهري بنجاح."
  };
}

export async function listMonthlyReports(month: string, req: AuthedRequest, pagination?: PaginationQueryInput) {
  const centerId = req.user?.role === "CENTER_MANAGER" ? req.user.centerId ?? undefined : undefined;
  if (req.user?.role === "CENTER_MANAGER" && !centerId) throw new ApiError(400, "لا يوجد مركز مرتبط بهذا الحساب.", "CENTER_REQUIRED");
  if (pagination) return db.monthlyReports.listPage({ month, centerId, page: pagination.page, pageSize: pagination.pageSize });
  return db.monthlyReports.list({ month, centerId });
}

export async function monthlySummary(month: string, req: AuthedRequest, pagination: PaginationQueryInput): Promise<MonthlyReportsSummary> {
  {
    const centerScope = req.user?.role === "CENTER_MANAGER" ? req.user.centerId ?? undefined : undefined;
    const [summary, missingCenters, latestUploads, monthlyStatistics] = await Promise.all([
      db.monthlyReports.summary({ month, centerId: centerScope }),
      db.monthlyReports.missingCenters({ month, centerId: centerScope, page: pagination.page, pageSize: pagination.pageSize }),
      db.uploadedFiles.list({ month, centerId: centerScope, limit: 8 }),
      db.monthlyReports.statistics(6)
    ]);
    return {
      month,
      totalRevenues: summary.totalRevenues,
      totalExpenses: summary.totalExpenses,
      totalSeminars: summary.totalSeminars,
      uploadedCenters: summary.uploadedCenterIds.length,
      missingCenters: missingCenters.items,
      missingCentersTotal: missingCenters.total,
      missingCentersPage: missingCenters.page,
      missingCentersPageSize: missingCenters.pageSize,
      latestUploads,
      monthlyStatistics
    };
  }
  const centerScope = req.user?.role === "CENTER_MANAGER" ? req.user?.centerId ?? undefined : undefined;
  const [allCenters, reports, latestUploads, monthlyStatistics] = await Promise.all([
    db.centers.list(),
    db.monthlyReports.list({ month, centerId: centerScope }),
    db.uploadedFiles.list({ month, centerId: centerScope, limit: 8 }),
    db.monthlyReports.statistics(6)
  ]);
  const centers = centerScope ? allCenters.filter((center) => center.id === centerScope) : allCenters;
  const uploaded = new Set(reports.map((report) => report.centerId));
  return {
    month,
    totalRevenues: reports.reduce((total, report) => total + report.revenues, 0),
    totalExpenses: reports.reduce((total, report) => total + report.expenses, 0),
    totalSeminars: reports.reduce((total, report) => total + report.seminarsCount, 0),
    uploadedCenters: uploaded.size,
    missingCenters: centers.filter((center) => !uploaded.has(center.id)).map((center) => ({ id: center.id, name: center.name, location: center.location })),
    missingCentersTotal: centers.filter((center) => !uploaded.has(center.id)).length,
    missingCentersPage: 1,
    missingCentersPageSize: centers.length,
    latestUploads,
    monthlyStatistics
  };
}

export async function listMonthlyUploads(month: string, req: AuthedRequest, pagination?: PaginationQueryInput) {
  const centerId = req.user?.role === "CENTER_MANAGER" ? req.user.centerId ?? undefined : undefined;
  if (pagination) return db.uploadedFiles.listPage({ month, centerId, page: pagination.page, pageSize: pagination.pageSize });
  return db.uploadedFiles.list({ month, centerId, limit: 50 });
}

export async function getExportData(month: string) {
  const [centers, reports] = await Promise.all([db.centers.list(), db.monthlyReports.list({ month })]);
  return { centers: centers as CenterRecord[], reports };
}
