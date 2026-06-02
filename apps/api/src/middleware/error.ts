import { NextFunction, Request, Response } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { isApiError } from "../errors/api-error";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (isApiError(err)) {
    return res.status(err.statusCode).json({ message: err.message, code: err.code, details: err.details });
  }

  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "File exceeds the maximum allowed size." : "File upload failed.";
    return res.status(400).json({ message, code: err.code });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({ message: "Invalid request data.", code: "VALIDATION_ERROR", details: err.flatten() });
  }

  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ message: "Invalid JSON body.", code: "INVALID_JSON" });
  }

  return res.status(500).json({ message: "Internal server error" });
}
