import { z } from "zod";

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    DEPLOY_TARGET: z.enum(["vercel", "ecs", "docker"]).default("vercel"),
    DATABASE_URL: z.string().min(1),
    QUEUE_PROVIDER: z.enum(["postgres", "sqs", "memory"]).default("postgres"),
    QUEUE_URL: z.string().optional(),
    ENCRYPTION_KEY: z.string().length(64).optional(),
    PIPEDREAM_CLIENT_ID: z.string().optional(),
    PIPEDREAM_CLIENT_SECRET: z.string().optional(),
    PIPEDREAM_PROJECT_ID: z.string().optional(),
    PIPEDREAM_ENVIRONMENT: z.enum(["development", "production"]).default("development"),
    SLACK_CLIENT_ID: z.string().optional(),
    SLACK_CLIENT_SECRET: z.string().optional(),
    TEAMS_CLIENT_ID: z.string().optional(),
    TEAMS_CLIENT_SECRET: z.string().optional(),
    GOOGLE_CHAT_CLIENT_ID: z.string().optional(),
    GOOGLE_CHAT_CLIENT_SECRET: z.string().optional(),
    DISCORD_CLIENT_ID: z.string().optional(),
    DISCORD_CLIENT_SECRET: z.string().optional(),
    APP_URL: z.string().url().optional(),
    AI_GATEWAY_URL: z.string().url().optional(),
    AI_GATEWAY_API_KEY: z.string().optional(),
    EMBEDDING_MODEL: z.string().min(1).optional(),
    MODEL_TIER_ULTRA: z.string().min(1).optional(),
    MODEL_TIER_ULTRA_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().optional(),
    MODEL_TIER_SMART: z.string().min(1).optional(),
    MODEL_TIER_SMART_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().optional(),
    MODEL_TIER_BALANCED: z.string().min(1).optional(),
    MODEL_TIER_BALANCED_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().optional(),
    CRON_SECRET: z.string().optional(),
    PROACTIVE_TICK_MS: z.coerce.number().int().positive().default(60_000),
    AUTH_SECRET: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.NODE_ENV !== "production") return;
    // next build runs with NODE_ENV=production; secrets are only required to serve.
    if (process.env.NEXT_PHASE === "phase-production-build") return;
    // Fail closed: a production deploy must never expose unauthenticated endpoints.
    for (const key of ["CRON_SECRET", "AUTH_SECRET"] as const) {
      if (!v[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: "required when NODE_ENV=production",
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment: ${msg}`);
  }
  return parsed.data;
}

export const env = loadEnv();

export function hasAiProvider(): boolean {
  return Boolean(env.AI_GATEWAY_URL && env.AI_GATEWAY_API_KEY);
}

export function hasSlackOAuth(): boolean {
  return Boolean(env.SLACK_CLIENT_ID && env.SLACK_CLIENT_SECRET);
}

export function hasTeamsOAuth(): boolean {
  return Boolean(env.TEAMS_CLIENT_ID && env.TEAMS_CLIENT_SECRET);
}

export function hasGoogleChatOAuth(): boolean {
  return Boolean(env.GOOGLE_CHAT_CLIENT_ID && env.GOOGLE_CHAT_CLIENT_SECRET);
}

export function hasDiscordOAuth(): boolean {
  return Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET);
}

export function hasPipedream(): boolean {
  return Boolean(
    env.PIPEDREAM_CLIENT_ID &&
    env.PIPEDREAM_CLIENT_SECRET &&
    env.PIPEDREAM_PROJECT_ID,
  );
}

export function hasGoogleAuth(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function hasGithubAuth(): boolean {
  return Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);
}
