import { z } from "zod";

const booleanString = z.enum(["true", "false"]).transform((value) => value === "true");

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  ATTIO_API_KEY: z.string().min(1).optional(),
  ATTIO_OBJECT: z.string().default("deals"),
  ATTIO_STAGE_ATTRIBUTE_ID: z.string().default("7a508d1c-2b5b-4e4a-b5c5-90e18a065138"),
  ATTIO_DETECTED_STAGE_ID: z.string().default("367c7aba-0965-4a4e-8f6f-7a687cf062df"),
  DRY_RUN: booleanString.default(true),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  SOURCE_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),
  MAX_ARTICLES_PER_SOURCE: z.coerce.number().int().positive().max(500).default(80),
  PORT: z.coerce.number().int().positive().default(3000),
  DASHBOARD_USER: z.string().default("radar"),
  DASHBOARD_PASSWORD: z.string().min(12).optional(),
  ATTIO_SYNC_LIMIT: z.coerce.number().int().min(1).max(100).default(1),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(overrides: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(overrides);
}
