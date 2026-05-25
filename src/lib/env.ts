import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  ISSUER_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().min(1),

  COOKIE_SECRET: z.string().min(32),
  SSO_COOKIE_NAME: z.string().default("aiprd_sso"),
  SSO_COOKIE_DOMAIN: z.string().optional().default(""),
  SSO_COOKIE_TTL_DAYS: z.coerce.number().int().positive().default(30),

  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  AUTH_CODE_TTL_MINUTES: z.coerce.number().int().positive().default(5),

  SIGNING_KEY_PATH: z.string().optional().default(""),
  JWKS_ROTATION_MONTHS: z.coerce.number().int().positive().default(6),

  // "console" = log to stdout (Phase 0 default, no real send).
  // "resend"  = call Resend API (requires RESEND_API_KEY).
  EMAIL_PROVIDER: z.enum(["console", "resend"]).default("console"),
  RESEND_API_KEY: z.string().optional().default(""),
  EMAIL_FROM: z.string().default("noreply@aiprd.club"),

  REDIS_URL: z.string().optional().default(""),

  // 32 random bytes as hex (`openssl rand -hex 32`). If missing, the AES
  // master key is derived from COOKIE_SECRET via scrypt — convenient for
  // dev, but set a dedicated key in production.
  JWKS_ENCRYPTION_KEY: z.string().optional().default(""),

  INTERNAL_API_TOKEN: z.string().min(16),
});

export type Env = z.infer<typeof EnvSchema>;

// Parse lazily so build-time without env still works for type-checking.
let cached: Env | null = null;
export function env(): Env {
  if (cached) return cached;
  cached = EnvSchema.parse(process.env);
  return cached;
}
