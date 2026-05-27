import crypto from "crypto";
import path from "path";
import multer from "multer";
import { env } from "../config/env";
import { ApiError } from "../errors/api-error";

const allowedExtensions = new Set([".xlsx", ".xls"]);
const allowedMimeTypes = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/octet-stream",
  "application/zip"
]);

export const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.EXCEL_MAX_UPLOAD_MB * 1024 * 1024, files: 1 }
});

export function sanitizeFilename(name: string) {
  const ext = path.extname(name).toLowerCase();
  const base = path.basename(name, ext).replace(/[^\p{L}\p{N}._-]+/gu, "_").replace(/^_+|_+$/g, "");
  return `${base || "monthly-report"}-${Date.now()}${ext}`;
}

export function fileHash(buffer: Buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function validateExcelFile(file?: Express.Multer.File) {
  if (!file) throw new ApiError(400, "يرجى اختيار ملف Excel للرفع.", "FILE_REQUIRED");
  const extension = path.extname(file.originalname).toLowerCase();
  if (!allowedExtensions.has(extension)) {
    throw new ApiError(400, "صيغة الملف غير مدعومة. الملفات المقبولة هي xlsx أو xls فقط.", "INVALID_EXTENSION");
  }
  if (!allowedMimeTypes.has(file.mimetype)) {
    throw new ApiError(400, "نوع الملف غير صحيح. يرجى رفع ملف Excel صالح.", "INVALID_MIME_TYPE");
  }
  if (extension === ".xlsx" && !(file.buffer[0] === 0x50 && file.buffer[1] === 0x4b)) {
    throw new ApiError(400, "محتوى الملف لا يطابق صيغة xlsx.", "INVALID_FILE_SIGNATURE");
  }
  if (extension === ".xls" && !(file.buffer[0] === 0xd0 && file.buffer[1] === 0xcf && file.buffer[2] === 0x11 && file.buffer[3] === 0xe0)) {
    throw new ApiError(400, "محتوى الملف لا يطابق صيغة xls.", "INVALID_FILE_SIGNATURE");
  }
  return {
    extension,
    storedName: sanitizeFilename(file.originalname),
    hash: fileHash(file.buffer)
  };
}
