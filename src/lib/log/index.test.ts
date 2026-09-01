import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createLogger } from "./index.ts";

describe("createLogger", () => {
  const lines: string[] = [];
  let originalLog: typeof console.log;
  let originalWarn: typeof console.warn;
  let originalError: typeof console.error;

  beforeEach(() => {
    lines.length = 0;
    originalLog = console.log;
    originalWarn = console.warn;
    originalError = console.error;
    console.log = (...args) => lines.push(String(args[0]));
    console.warn = (...args) => lines.push(String(args[0]));
    console.error = (...args) => lines.push(String(args[0]));
    process.env.LOG_LEVEL = "debug";
  });

  afterEach(() => {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
    delete process.env.LOG_LEVEL;
  });

  it("emits structured JSON with bound fields", () => {
    const logger = createLogger("worker", { runId: "run-1" });
    logger.info("job started", { source: "slack" });

    assert.equal(lines.length, 1);
    const parsed = JSON.parse(lines[0]!) as Record<string, unknown>;
    assert.equal(parsed.component, "worker");
    assert.equal(parsed.runId, "run-1");
    assert.equal(parsed.msg, "job started");
    assert.equal(parsed.source, "slack");
    assert.equal(parsed.level, "info");
  });

  it("respects LOG_LEVEL", () => {
    process.env.LOG_LEVEL = "error";
    const logger = createLogger("worker");
    logger.info("hidden");
    logger.error("visible");

    assert.equal(lines.length, 1);
    const parsed = JSON.parse(lines[0]!) as Record<string, unknown>;
    assert.equal(parsed.msg, "visible");
  });

  it("child logger merges context", () => {
    const parent = createLogger("agent", { projectId: "p1" });
    parent.child({ runId: "r1" }).debug("step");

    const parsed = JSON.parse(lines[0]!) as Record<string, unknown>;
    assert.equal(parsed.projectId, "p1");
    assert.equal(parsed.runId, "r1");
  });
});
