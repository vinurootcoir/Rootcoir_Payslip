import { z } from "zod";

/**
 * Session lifetime is JWT_EXPIRY. The spec default is 7d.
 * Payslip data is sensitive, so production should prefer 12h unless
 * the operator explicitly accepts a longer shared-workstation risk.
 * The same value becomes the JWT exp claim and the cookie Max-Age.
 * SMTP_SECURE must be set explicitly. The port is not treated as proof of TLS.
 */

const PLACEHOLDER_SECRETS = new Set([
  "change-me",
  "changeme",
  "secret",
  "jwt_secret",
  "your-secret-here",
  "replace-me",
  "password",
  "test",
  "development",
]);

const emptyToUndefined = (value: unknown) =>
  value === "" || value === undefined ? undefined : value;

const postgresUrl = z
  .string()
  .refine(
    (value) =>
      value.startsWith("postgres://") || value.startsWith("postgresql://"),
    "Invalid database URL",
  );

const envSchema = z
  .object({
    NODE_ENV: z.preprocess(
      emptyToUndefined,
      z.enum(["development", "test", "production"]).default("development"),
    ),
    DATABASE_URL: postgresUrl,
    DIRECT_URL: z.preprocess(emptyToUndefined, postgresUrl.optional()),
    JWT_SECRET: z.string().min(32),
    JWT_EXPIRY: z.preprocess(
      (value) => (value === undefined || value === "" ? "7d" : value),
      z.string().regex(/^\d+[smhd]$/),
    ),
    SMTP_HOST: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    SMTP_PORT: z.preprocess(emptyToUndefined, z.string().regex(/^\d+$/).optional()),
    SMTP_USER: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    SMTP_PASSWORD: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    SMTP_FROM: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    SMTP_SECURE: z.preprocess(
      emptyToUndefined,
      z.enum(["true", "false"]).optional(),
    ),
  })
  .superRefine((data, ctx) => {
    const smtpKeys = [
      "SMTP_HOST",
      "SMTP_PORT",
      "SMTP_USER",
      "SMTP_PASSWORD",
      "SMTP_FROM",
      "SMTP_SECURE",
    ] as const;
    const anySmtp = smtpKeys.some((key) => data[key] !== undefined);
    const requireSmtp = data.NODE_ENV === "production" || anySmtp;

    if (requireSmtp) {
      for (const key of smtpKeys) {
        if (data[key] === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: "SMTP setting is missing",
          });
        }
      }
    }

    if (data.SMTP_PORT !== undefined) {
      const port = Number(data.SMTP_PORT);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["SMTP_PORT"],
          message: "SMTP port is invalid",
        });
      }
    }

    if (data.NODE_ENV === "production") {
      if (
        PLACEHOLDER_SECRETS.has(data.JWT_SECRET.toLowerCase()) ||
        new Set(data.JWT_SECRET).size < 8
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["JWT_SECRET"],
          message: "JWT_SECRET does not meet production requirements",
        });
      }
      for (const key of ["DATABASE_URL", "DIRECT_URL"] as const) {
        const value = data[key];
        if (value && !value.includes("sslmode=require")) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: "Database URL must set sslmode=require in production",
          });
        }
      }
    }
  });

export type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
  secure: boolean;
};

export type AppEnv = {
  nodeEnv: "development" | "test" | "production";
  databaseUrl: string;
  directUrl: string | null;
  jwtSecret: string;
  jwtExpiry: string;
  smtp: SmtpConfig | null;
};

export class EnvironmentConfigError extends Error {
  readonly fields: string[];

  constructor(fields: string[]) {
    super(`Invalid environment configuration: ${fields.join(", ")}`);
    this.name = "EnvironmentConfigError";
    this.fields = fields;
  }
}

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const fields = [
      ...new Set(
        parsed.error.issues.map((issue) => issue.path.join(".") || "environment"),
      ),
    ];
    throw new EnvironmentConfigError(fields);
  }

  const data = parsed.data;
  const smtp =
    data.SMTP_HOST &&
    data.SMTP_PORT &&
    data.SMTP_USER &&
    data.SMTP_PASSWORD &&
    data.SMTP_FROM &&
    data.SMTP_SECURE
      ? {
          host: data.SMTP_HOST,
          port: Number(data.SMTP_PORT),
          user: data.SMTP_USER,
          password: data.SMTP_PASSWORD,
          from: data.SMTP_FROM,
          secure: data.SMTP_SECURE === "true",
        }
      : null;

  cached = {
    nodeEnv: data.NODE_ENV,
    databaseUrl: data.DATABASE_URL,
    directUrl: data.DIRECT_URL ?? null,
    jwtSecret: data.JWT_SECRET,
    jwtExpiry: data.JWT_EXPIRY,
    smtp,
  };
  return cached;
}

/** Clears the cache. Tests use this; application code should not. */
export function resetEnvCache(): void {
  cached = null;
}
