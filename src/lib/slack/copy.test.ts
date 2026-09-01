import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSlackCopyPrompt } from "./copy-prompt.ts";

test("welcome prompt references workspace and operator", () => {
  const prompt = buildSlackCopyPrompt("welcome", {
    workspaceName: "Acme",
    operatorName: "Alex",
  });
  assert.match(prompt, /Acme/);
  assert.match(prompt, /Alex/);
});

test("ack prompt includes the user message", () => {
  const prompt = buildSlackCopyPrompt("ack", {
    userMessage: "Summarize our Postgres schemas",
  });
  assert.match(prompt, /Summarize our Postgres schemas/);
  assert.match(prompt, /do not answer the question yet/i);
});

test("budget prompt explains the cap", () => {
  const prompt = buildSlackCopyPrompt("budget_exceeded", {
    workspaceName: "Acme",
    operatorName: "Alex",
  });
  assert.match(prompt, /budget/i);
  assert.match(prompt, /Acme/);
});
