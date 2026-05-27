import { config } from "dotenv";
import { z } from "zod";
config();

const optionalUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().url().optional()
);

const envSchema = z
  .object({
    PORT: z.string().default("4000"),
    NODE_ENV: z.string().default("development"),
    DATABASE_URL: optionalUrl,
    MONGODB_URL: optionalUrl,
    JWT_SECRET: z.string().min(8),
    CORS_ORIGIN: z.string().optional(),
    FRONTEND_URL: z.string().url().optional(),
    RAILWAY_PUBLIC_DOMAIN: z.string().optional(),
    EXCEL_MAX_UPLOAD_MB: z.coerce.number().int().positive().default(10)
  })
  .transform((value) => {
    const isDeployed = value.NODE_ENV === "production" || Boolean(value.RAILWAY_PUBLIC_DOMAIN);
    const corsOrigin = isDeployed && value.CORS_ORIGIN?.includes("localhost") ? undefined : value.CORS_ORIGIN;

    return {
      ...value,
      CORS_ORIGIN:
        value.FRONTEND_URL ||
        corsOrigin ||
        (isDeployed ? "*" : "http://localhost:3000")
    };
  })
  .refine((value) => Boolean(value.DATABASE_URL || value.MONGODB_URL), {
    message: "Set at least one database URL: DATABASE_URL or MONGODB_URL"
  });
export const env = envSchema.parse(process.env);
