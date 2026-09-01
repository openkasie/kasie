import { execSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const drizzleKit = path.join(root, "node_modules/.bin/drizzle-kit");

/** Load `.env` when present (scripts-only; not validated by src/lib/env). */
export function loadProjectEnv() {
  const envPath = path.join(root, ".env");
  if (existsSync(envPath)) loadEnvFile(envPath);
}

/** @param {number | null | undefined} status @param {boolean} [allowFailure] */
export function exitUnlessOk(status, allowFailure = false) {
  if (status !== 0 && !allowFailure) process.exit(status ?? 1);
}

/** @param {string} cmd @param {string[]} args @param {boolean} [allowFailure] */
export function run(cmd, args, allowFailure = false) {
  const result = spawnSync(cmd, args, { cwd: root, stdio: "inherit" });
  exitUnlessOk(result.status, allowFailure);
}

/**
 * @param {string} entry
 * @param {string} outfile
 * @param {{ alias?: boolean, external?: string[] }} [opts]
 */
export function bundle(entry, outfile, opts = {}) {
  const out = path.join(root, outfile);
  const parts = [
    "npx esbuild",
    entry,
    "--bundle",
    "--platform=node",
    "--format=cjs",
    `--outfile=${out}`,
    "--packages=external",
  ];
  if (opts.alias) parts.push("--alias:@=./src");
  for (const pkg of opts.external ?? []) parts.push(`--external:${pkg}`);
  execSync(parts.join(" "), { cwd: root, stdio: "inherit" });
}

/** @param {string | undefined} originArg */
export function resolvePublicOrigin(originArg) {
  const ngrokDomain = process.env.NGROK_DOMAIN?.trim();
  return (
    originArg?.trim() ??
    process.env.APP_URL?.trim() ??
    (ngrokDomain ? `https://${ngrokDomain.replace(/^https?:\/\//, "")}` : undefined)
  );
}

/** @param {string} rawOrigin */
export function parseHttpsOrigin(rawOrigin) {
  const url = new URL(rawOrigin);
  if (url.protocol !== "https:") {
    throw new Error("Origin must use https:// — Slack requires publicly reachable HTTPS URLs.");
  }
  return `${url.protocol}//${url.host}`;
}

/** @param {string} origin */
export function slackEndpointUrls(origin) {
  const base = origin.replace(/\/$/, "");
  return {
    app: `${base}/`,
    oauthRedirect: `${base}/api/slack/oauth/callback`,
    events: `${base}/api/slack/events`,
    interactions: `${base}/api/slack/interactions`,
  };
}

/** @param {string} origin */
export function printSlackDevBanner(origin) {
  const urls = slackEndpointUrls(origin);
  console.log(`
┌─ Slack local dev (static ngrok) ─────────────────────────────
│ Open Kasie:           ${urls.app}
│ Slack Redirect URL:   ${urls.oauthRedirect}
│ Slack Events URL:    ${urls.events}
│ Slack Interactivity:  ${urls.interactions}
│
│ Browse via the ngrok URL above — not localhost — when testing Slack.
│ Configure these URLs once in your Slack app; the domain stays fixed.
│ Clean onboarding test: npm run db:fresh
└──────────────────────────────────────────────────────────────
`);
}

/** @param {string} script @param {string} [details] */
export function printUsage(script, details) {
  console.error(`Usage: node scripts/${script}${details ? ` ${details}` : ""}`);
}
