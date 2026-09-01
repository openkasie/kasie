#!/usr/bin/env node
/** Bundle src/worker/main.ts to dist/main.js. */
import path from "node:path";
import { bundle, root } from "./shared.mjs";

bundle("src/worker/main.ts", "dist/main.js", {
  external: ["@neondatabase/serverless", "drizzle-orm", "postgres"],
});

console.log(`Worker bundle → ${path.join(root, "dist/main.js")}`);
