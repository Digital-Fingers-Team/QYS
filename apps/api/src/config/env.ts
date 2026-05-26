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
    DATABASE_URL: optionalUrl,
    MONGODB_URL: optionalUrl,
    JWT_SECRET: z.string().min(8),
    CORS_ORIGIN: z.string().url()
  })
  .refine((value) => Boolean(value.DATABASE_URL || value.MONGODB_URL), {
    message: "Set at least one database URL: DATABASE_URL or MONGODB_URL"
  });
export const env = envSchema.parse(process.env);
