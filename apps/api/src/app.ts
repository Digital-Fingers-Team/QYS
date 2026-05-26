import express from "express"; import cors from "cors"; import router from "./routes"; import { errorHandler } from "./middleware/error"; import { env } from "./config/env";
const app = express();
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json());
app.get('/health', (_req,res)=>res.json({status:'ok'}));
app.use('/api', router);
app.use(errorHandler);
export default app;
