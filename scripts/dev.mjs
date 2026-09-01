#!/usr/bin/env node
/**
 * Local dev: Next.js, optional ngrok tunnel, and worker (or web-only heartbeat).
 *
 *   node scripts/dev.mjs
 *
 * Env: DEV_PORT, WEB_ONLY, PROACTIVE_TICK_MS, NGROK_AUTHTOKEN, NGROK_DOMAIN
 */
import { execSync, spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { loadProjectEnv, printSlackDevBanner, root } from "./shared.mjs";

loadProjectEnv();

const DEV_PORT = Number(process.env.DEV_PORT ?? 3000);
const WEB_ONLY = process.env.WEB_ONLY === "1";
const PROACTIVE_TICK_MS = Number(process.env.PROACTIVE_TICK_MS ?? 60_000);

/** @type {import("node:child_process").ChildProcess[]} */
const children = [];

/** @type {import("@ngrok/ngrok").Listener | null} */
let ngrokListener = null;

/** @param {string} prefix @param {import("node:stream").Readable | null} stream */
function prefixStream(prefix, stream) {
  if (!stream) return;
  stream.on("data", (chunk) => {
    for (const line of chunk.toString().split("\n")) {
      if (line) process.stdout.write(`[${prefix}] ${line}\n`);
    }
  });
}

/** @param {string} prefix @param {string} command @param {string[]} args */
function spawnProc(prefix, command, args) {
  const child = spawn(command, args, {
    cwd: root,
    env: process.env,
    stdio: ["inherit", "pipe", "pipe"],
  });
  prefixStream(prefix, child.stdout);
  prefixStream(prefix, child.stderr);
  child.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[${prefix}] exited with code ${code}`);
      shutdown(code);
    }
  });
  children.push(child);
}

/** @param {number} [code] */
async function shutdown(code = 0) {
  for (const child of children) child.kill("SIGTERM");
  if (ngrokListener) {
    try {
      await ngrokListener.close();
    } catch {
      // ignore teardown errors
    }
  }
  process.exit(code);
}

/** @param {number} port */
function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "127.0.0.1");
  });
}

/** @param {number} port */
function describePortOwner(port) {
  try {
    return execSync(`lsof -i :${port} -sTCP:LISTEN -P -n 2>/dev/null | tail -n +2`, {
      encoding: "utf8",
    }).trim();
  } catch {
    return "";
  }
}

/** @param {number} port */
async function assertDevPortAvailable(port) {
  if (await isPortFree(port)) return;

  const owner = describePortOwner(port);
  console.error(`[dev] Port ${port} is already in use — Next.js and ngrok must share the same port.`);
  if (owner) console.error(`[dev] ${owner.replace(/\n/g, "\n[dev] ")}`);
  console.error(
    `[dev] Stop the process above, or set DEV_PORT to another free port in .env.`,
  );
  process.exit(1);
}

/** @param {number} port @param {number} [timeoutMs] */
async function waitForNextReady(port, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`, { redirect: "manual" });
      if (res.status < 500) return;
    } catch {
      // Next still booting
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Next.js did not become ready on port ${port} within ${timeoutMs / 1000}s`);
}

/** @param {number} port @returns {Promise<boolean>} */
async function startNgrok(port) {
  const token = process.env.NGROK_AUTHTOKEN?.trim();
  const domain = process.env.NGROK_DOMAIN?.trim();

  if (!token && !domain) {
    console.log(
      "[dev] Slack tunnel skipped — set NGROK_AUTHTOKEN and NGROK_DOMAIN in .env (see wiki/2-slack-app-setup.md)",
    );
    return false;
  }

  if (!token || !domain) {
    console.error(
      "[dev] NGROK_AUTHTOKEN and NGROK_DOMAIN must both be set for the Slack tunnel.",
    );
    process.exit(1);
  }

  try {
    const ngrok = await import("@ngrok/ngrok");
    ngrokListener = await ngrok.forward({
      addr: port,
      authtoken: token,
      domain,
    });
    const origin = ngrokListener.url();
    if (!origin) {
      throw new Error("ngrok returned no public URL");
    }
    process.env.APP_URL = origin.replace(/\/$/, "");
    console.log(`[dev] ngrok tunnel → ${process.env.APP_URL} (→ localhost:${port})`);
    printSlackDevBanner(process.env.APP_URL);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[dev] ngrok failed: ${msg}`);
    if (msg.includes("ERR_NGROK_334") || msg.includes("already online")) {
      console.error(
        "[dev] That domain is still bound to another ngrok session. Stop it at https://dashboard.ngrok.com/agents (or Endpoints), wait ~30s, then retry.",
      );
    } else {
      console.error(
        "[dev] Verify NGROK_AUTHTOKEN and that NGROK_DOMAIN is reserved in the ngrok dashboard.",
      );
    }
    process.exit(1);
  }
}

/** @param {number} port */
function startWeb(port) {
  spawnProc("web", "npx", ["next", "dev", "-p", String(port)]);
}

function startWorker() {
  spawnProc("worker", "node", ["--env-file=.env", "dist/main.js"]);
}

/** @param {number} port */
function startHeartbeatTicker(port) {
  console.log(
    `[dev] Web-only mode: posting /api/cron/heartbeat every ${PROACTIVE_TICK_MS / 1000}s`,
  );
  const secret = process.env.CRON_SECRET?.trim();
  const tick = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/cron/heartbeat`, {
        method: "POST",
        headers: secret ? { Authorization: `Bearer ${secret}` } : {},
      });
      if (!res.ok) console.error(`[dev] heartbeat returned ${res.status}`);
    } catch (err) {
      console.error(`[dev] heartbeat failed: ${err instanceof Error ? err.message : err}`);
    }
  };
  setInterval(tick, PROACTIVE_TICK_MS);
  void tick();
}

async function main() {
  await assertDevPortAvailable(DEV_PORT);
  startWeb(DEV_PORT);
  console.log(`[dev] Waiting for Next.js on http://localhost:${DEV_PORT}...`);

  try {
    await waitForNextReady(DEV_PORT);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[dev] ${msg}`);
    await shutdown(1);
    return;
  }

  await startNgrok(DEV_PORT);
  if (WEB_ONLY) {
    startHeartbeatTicker(DEV_PORT);
  } else {
    startWorker();
  }
}

if (WEB_ONLY) {
  void main();
} else {
  console.log("[dev] Building worker...");
  const build = spawn("node", [path.join(root, "scripts/worker.mjs")], {
    cwd: root,
    stdio: "inherit",
  });
  build.on("exit", async (code) => {
    if (code !== 0) {
      await shutdown(code ?? 1);
      return;
    }
    await main();
  });
}

process.on("SIGINT", () => void shutdown(0));
process.on("SIGTERM", () => void shutdown(0));
