#!/usr/bin/env node
/**
 * Database tooling.
 *
 *   node scripts/db.mjs generate
 *   node scripts/db.mjs migrate
 *   node scripts/db.mjs fresh [-- --force]
 */
import postgres from "postgres";
import { drizzleKit, loadProjectEnv, printUsage, run } from "./shared.mjs";

loadProjectEnv();

const command = process.argv[2];
const passthrough = process.argv.slice(3);

function migrate() {
  run("node", ["--env-file=.env", drizzleKit, "migrate"]);
}

async function resetDatabase() {
  const force = passthrough.includes("--force");
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  if (process.env.NODE_ENV === "production" && !force) {
    console.error(
      "Refusing to reset a production database. Re-run with --force if you are sure.",
    );
    process.exit(1);
  }

  const sql = postgres(url, { max: 1 });
  try {
    console.log("Dropping public schema...");
    await sql.unsafe(`
      DROP SCHEMA IF EXISTS drizzle CASCADE;
      DROP SCHEMA IF EXISTS public CASCADE;
      CREATE SCHEMA public;
    `);
    console.log("Database reset complete.");
  } finally {
    await sql.end();
  }
}

async function fresh() {
  await resetDatabase();
  migrate();
}

const usage = `Usage: node scripts/db.mjs <command> [args...]

Commands:
  generate   drizzle-kit generate
  migrate    drizzle-kit migrate
  fresh      drop public schema and migrate (empty DB — onboarding test)
`;

if (!command) {
  console.error(usage);
  process.exit(1);
}

switch (command) {
  case "generate":
    run("node", ["--env-file=.env", drizzleKit, "generate"]);
    break;
  case "migrate":
    migrate();
    break;
  case "fresh":
    await fresh();
    break;
  default:
    printUsage("db.mjs", "<generate|migrate|fresh>");
    console.error(`\nUnknown command: ${command}\n\n${usage}`);
    process.exit(1);
}
