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

test("discovery_started prompt references integration and forbids canned copy", () => {
  const prompt = buildSlackCopyPrompt("discovery_started", {
    integrationNickname: "Neon account",
    appSlug: "neon",
  });
  assert.match(prompt, /Neon account/);
  assert.match(prompt, /neon/);
  assert.match(prompt, /do not use canned status-update language/i);
});

test("discovery_report prompt targets non-technical personal tone", () => {
  const prompt = buildSlackCopyPrompt("discovery_report", {
    integrationNickname: "Neon Postgres account",
    appSlug: "neon_postgres",
    discoveryFindings: "• Table public.users\n• 20 tables total",
  });
  assert.match(prompt, /normal person/i);
  assert.match(prompt, /Never paste JSON/i);
  assert.match(prompt, /No 'try asking me'/i);
});
