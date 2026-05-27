import { NextFunction, Request, Response } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { isApiError } from "../errors/api-error";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (isApiError(err)) return res.status(err.statusCode).json({ message: err.message, code: err.code, details: err.details });
  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "حجم الملف أكبر من الحد المسموح." : "تعذر رفع الملف.";
    return res.status(400).json({ message, code: err.code });
  }
  if (err instanceof ZodError) return res.status(400).json({ message: "البيانات المرسلة غير صحيحة.", code: "VALIDATION_ERROR", details: err.flatten() });
  if (err instanceof Error) return res.status(400).json({ message: err.message });
  return res.status(500).json({ message: "Internal server error" });
}
