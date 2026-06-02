import express from "express";
import cors from "cors";
import router from "./routes";
import { errorHandler } from "./middleware/error";
import { globalRateLimit, rejectMongoOperators, rejectUnexpectedBody, rejectUnexpectedQuery, securityHeaders } from "./middleware/security";
import { ApiError } from "./errors/api-error";
import { env } from "./config/env";
const app = express();

const configuredOrigins = env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean);

function isAllowedOrigin(origin?: string) {
  if (!origin) return true;
  if (configuredOrigins.includes(origin)) return true;
  if (env.NODE_ENV !== "production" && /^http:\/\/localhost:\d+$/i.test(origin)) return true;
  return false;
}

if (env.TRUST_PROXY) app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(securityHeaders);
app.use(globalRateLimit);
app.use(cors({
  credentials: false,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type"],
  maxAge: 600,
  origin(origin, callback) {
    callback(null, isAllowedOrigin(origin));
  }
}));
app.use(express.json({ limit: env.JSON_BODY_LIMIT, strict: true }));
app.use(rejectMongoOperators);
app.use(rejectUnexpectedBody);
app.use(rejectUnexpectedQuery);
app.get('/', (_req,res)=>res.json({name:'qys-api',status:'ok'}));
app.get('/health', (_req,res)=>res.json({status:'ok'}));
app.use('/api', router);
app.use((_req, _res, next) => next(new ApiError(404, "Not found", "NOT_FOUND")));
app.use(errorHandler);
export default app;
