import { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { ApiError } from "../errors/api-error";
import { env } from "../config/env";

function hasMongoOperator(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(hasMongoOperator);
  return Object.entries(value as Record<string, unknown>).some(([key, child]) => key.startsWith("$") || key.includes(".") || hasMongoOperator(child));
}

export function rejectMongoOperators(req: Request, _res: Response, next: NextFunction) {
  if (hasMongoOperator(req.body) || hasMongoOperator(req.query) || hasMongoOperator(req.params)) {
    return next(new ApiError(400, "Invalid request payload.", "INVALID_REQUEST"));
  }
  return next();
}

export function rejectUnexpectedQuery(req: Request, _res: Response, next: NextFunction) {
  const keys = Object.keys(req.query);
  if (!keys.length) return next();

  const monthlyPaths = new Set([
    "/monthly-reports",
    "/monthly-reports/summary",
    "/monthly-reports/uploads",
    "/api/monthly-reports",
    "/api/monthly-reports/summary",
    "/api/monthly-reports/uploads"
  ]);
  const monthlyDownloadPaths = new Set([
    "/monthly-reports/export",
    "/monthly-reports/template",
    "/api/monthly-reports/export",
    "/api/monthly-reports/template"
  ]);
  const paginatedPaths = new Set([
    "/users",
    "/centers",
    "/challenges",
    "/ideas",
    "/complaints",
    "/reports",
    "/activities",
    "/api/users",
    "/api/centers",
    "/api/challenges",
    "/api/ideas",
    "/api/complaints",
    "/api/reports",
    "/api/activities"
  ]);
  if (monthlyPaths.has(req.path) && keys.every((key) => ["month", "page", "pageSize"].includes(key))) return next();
  if (monthlyDownloadPaths.has(req.path) && keys.length === 1 && keys[0] === "month") return next();
  if (paginatedPaths.has(req.path) && keys.every((key) => ["page", "pageSize", "q"].includes(key))) return next();

  return next(new ApiError(400, "Unexpected query parameter.", "UNEXPECTED_QUERY_PARAMETER"));
}

function isIdeaVotePath(path: string) {
  return /^\/(?:api\/)?ideas\/\d+\/vote$/.test(path);
}

export function rejectUnexpectedBody(req: Request, _res: Response, next: NextFunction) {
  const hasBody = Boolean(req.body && typeof req.body === "object" && Object.keys(req.body).length);
  if (!hasBody) return next();
  if (req.method === "GET" || req.method === "DELETE") {
    return next(new ApiError(400, "Unexpected request body.", "UNEXPECTED_REQUEST_BODY"));
  }
  if (req.method === "POST" && isIdeaVotePath(req.path)) {
    return next(new ApiError(400, "Unexpected request body.", "UNEXPECTED_REQUEST_BODY"));
  }
  return next();
}

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
      frameAncestors: ["'none'"],
      imgSrc: ["'none'"],
      objectSrc: ["'none'"],
      scriptSrc: ["'none'"],
      styleSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  hsts: env.NODE_ENV === "production" ? { maxAge: 15552000, includeSubDomains: true, preload: true } : false,
  frameguard: { action: "deny" },
  noSniff: true,
  referrerPolicy: { policy: "no-referrer" }
});

const standardLimitResponse = { message: "Too many requests. Please try again later.", code: "RATE_LIMITED" };

export const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === "test" ? 10000 : 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: standardLimitResponse
});

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === "test" ? 10000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: standardLimitResponse
});

export const uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: env.NODE_ENV === "test" ? 10000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: standardLimitResponse
});
