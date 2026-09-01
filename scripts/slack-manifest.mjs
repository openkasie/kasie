#!/usr/bin/env node
/**
 * Render deploy/slack/manifest.yaml with a concrete public origin.
 *
 *   node scripts/slack-manifest.mjs <public-https-origin> [--write <path>]
 *   APP_URL=https://kasie-dev.ngrok-free.app node scripts/slack-manifest.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  loadProjectEnv,
  parseHttpsOrigin,
  printUsage,
  resolvePublicOrigin,
  root,
} from "./shared.mjs";

loadProjectEnv();

const PLACEHOLDER = "https://your-app.example.com";
const args = process.argv.slice(2).filter((a) => a !== "--");
const writeIdx = args.indexOf("--write");
const writePath = writeIdx >= 0 ? args[writeIdx + 1] : null;
const originArg = args.find((a) => !a.startsWith("--"));
const rawOrigin = resolvePublicOrigin(originArg);

if (!rawOrigin) {
  printUsage("slack-manifest.mjs", "<public-https-origin> [--write <path>]");
  console.error("   or: APP_URL=<public-https-origin> node scripts/slack-manifest.mjs");
  console.error("   or: set APP_URL / NGROK_DOMAIN in .env");
  process.exit(1);
}

let origin;
try {
  origin = parseHttpsOrigin(rawOrigin);
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}

const templatePath = path.join(root, "deploy/slack/manifest.yaml");
const rendered = readFileSync(templatePath, "utf8").replaceAll(PLACEHOLDER, origin);

if (writePath) {
  writeFileSync(writePath, rendered, "utf8");
  console.error(`Wrote ${writePath}`);
} else {
  process.stdout.write(rendered);
}
