import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import {
  completeSlackMessage,
  normalizeSlackMrkdwn,
  signalSlackProcessing,
  SLACK_PROCESSING_REACTION,
} from "./message.ts";

afterEach(() => {
  mock.restoreAll();
});

test("signals processing with reaction only", async () => {
  const calls: Array<{ method: string; body: Record<string, unknown> }> = [];
  mock.method(globalThis, "fetch", async (url: string, init?: RequestInit) => {
    calls.push({
      method: url.replace("https://slack.com/api/", ""),
      body: JSON.parse(String(init?.body)) as Record<string, unknown>,
    });
    return new Response(JSON.stringify({ ok: true }));
  });

  await signalSlackProcessing({
    channel: "C123",
    messageTs: "1111.2222",
    botToken: "xoxb-test",
  });

  assert.deepEqual(calls, [
    {
      method: "reactions.add",
      body: {
        channel: "C123",
        timestamp: "1111.2222",
        name: SLACK_PROCESSING_REACTION,
      },
    },
  ]);
});

test("completes with threaded reply then removes reaction", async () => {
  const methods: string[] = [];
  mock.method(globalThis, "fetch", async (url: string) => {
    methods.push(url.replace("https://slack.com/api/", ""));
    return new Response(JSON.stringify({ ok: true }));
  });

  await completeSlackMessage({
    channel: "C123",
    messageTs: "1111.2222",
    threadTs: "3333.4444",
    botToken: "xoxb-test",
    text: "Here is the answer.",
  });

  assert.deepEqual(methods, ["chat.postMessage", "reactions.remove"]);
});

test("normalizeSlackMrkdwn converts GitHub-style markdown", () => {
  const input =
    "- **Messaging Me:** Reach out here.\n- **@Mentioning Me:** Use `/invite` then @mention.";
  const expected =
    "• *Messaging Me:* Reach out here.\n• *@Mentioning Me:* Use `/invite` then @mention.";
  assert.equal(normalizeSlackMrkdwn(input), expected);
});

test("normalizeSlackMrkdwn leaves inline code spans unchanged", () => {
  assert.equal(
    normalizeSlackMrkdwn("**Run** `/invite` in a channel"),
    "*Run* `/invite` in a channel",
  );
});
