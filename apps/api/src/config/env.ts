import { config } from "dotenv";
import { z } from "zod";
config();

const envSchema = z
  .object({
    PORT: z.string().default("4000"),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    MONGODB_URL: z
      .string()
      .min(1)
      .refine((value) => /^mongodb(\+srv)?:\/\//i.test(value), "MONGODB_URL must be a MongoDB connection string"),
    JWT_SECRET: z
      .string()
      .min(32)
      .refine((value) => !["change_me", "changeme", "secret", "password"].includes(value.toLowerCase()), "JWT_SECRET must not be a placeholder"),
    JWT_EXPIRES_IN: z.string().regex(/^\d+[smhd]$/).default("8h"),
    JWT_ISSUER: z.string().min(2).default("qys-api"),
    JWT_AUDIENCE: z.string().min(2).default("qys-web"),
    CORS_ORIGIN: z.string().optional(),
    FRONTEND_URL: z.string().url().optional(),
    RAILWAY_PUBLIC_DOMAIN: z.string().optional(),
    EXCEL_MAX_UPLOAD_MB: z.coerce.number().int().positive().max(10).default(5),
    JSON_BODY_LIMIT: z.string().default("2mb"),
    TRUST_PROXY: z.coerce.boolean().default(false),
    OPENAI_API_KEY: z.string().optional(),
    OPENAI_MODEL: z.string().default("gpt-4o-mini"),
    GEMINI_API_KEY: z.string().optional(),
    GOOGLE_API_KEY: z.string().optional(),
    GEMINI_MODEL: z.string().default("gemini-2.0-flash"),
    XAI_API_KEY: z.string().optional(),
    GROK_API_KEY: z.string().optional(),
    GROK_MODEL: z.string().default("grok-4.3"),
    OPENROUTER_API_KEY: z.string().optional(),
    OPENROUTER_MODEL: z.string().default("openai/gpt-4o-mini")
  })
  .transform((value) => {
    const isDeployed = value.NODE_ENV === "production" || Boolean(value.RAILWAY_PUBLIC_DOMAIN);
    const configuredCors = value.FRONTEND_URL || value.CORS_ORIGIN;
    if (isDeployed && (!configuredCors || configuredCors.includes("*") || configuredCors.includes("localhost"))) {
      throw new Error("Production deployments must set FRONTEND_URL or CORS_ORIGIN to explicit HTTPS origin(s).");
    }
    const corsOrigin = isDeployed && value.CORS_ORIGIN?.includes("localhost") ? undefined : value.CORS_ORIGIN;

    return {
      ...value,
      CORS_ORIGIN:
        value.FRONTEND_URL ||
        corsOrigin ||
        "http://localhost:3000"
    };
  });
export const env = envSchema.parse(process.env);
