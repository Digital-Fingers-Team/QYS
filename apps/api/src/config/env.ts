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
    RAILWAY_PUBLIC_DOMAIN: z.string().optional()
  })
  .transform((value) => ({
    ...value,
    CORS_ORIGIN:
      value.CORS_ORIGIN ||
      value.FRONTEND_URL ||
      (value.RAILWAY_PUBLIC_DOMAIN ? `https://${value.RAILWAY_PUBLIC_DOMAIN}` : undefined) ||
      (value.NODE_ENV === "production" ? "*" : "http://localhost:3000")
  }))
  .refine((value) => Boolean(value.DATABASE_URL || value.MONGODB_URL), {
    message: "Set at least one database URL: DATABASE_URL or MONGODB_URL"
  });
export const env = envSchema.parse(process.env);
