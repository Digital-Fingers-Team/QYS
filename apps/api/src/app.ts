import express from "express"; import cors from "cors"; import router from "./routes"; import { errorHandler } from "./middleware/error"; import { env } from "./config/env";
const app = express();

const configuredOrigins = env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean);

function isAllowedOrigin(origin?: string) {
  if (!origin) return true;
  if (configuredOrigins.includes("*") || configuredOrigins.includes(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.up\.railway\.app$/i.test(origin)) return true;
  if (env.NODE_ENV !== "production" && /^http:\/\/localhost:\d+$/i.test(origin)) return true;
  return false;
}

app.use(cors({
  origin(origin, callback) {
    callback(null, isAllowedOrigin(origin));
  }
}));
app.use(express.json());
app.get('/', (_req,res)=>res.json({name:'qys-api',status:'ok'}));
app.get('/health', (_req,res)=>res.json({status:'ok'}));
app.use('/api', router);
app.use(router);
app.use(errorHandler);
export default app;
