import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeSlackMrkdwn } from "./mrkdwn.ts";

test("converts GitHub bold to Slack mrkdwn", () => {
  const input =
    "- **Messaging Me:** Reach out here.\n- **@Mentioning Me:** Use `/invite` then @mention.";
  const expected =
    "• *Messaging Me:* Reach out here.\n• *@Mentioning Me:* Use `/invite` then @mention.";
  assert.equal(normalizeSlackMrkdwn(input), expected);
});

test("leaves inline code spans unchanged", () => {
  const input = "**Run** `/invite` in a channel";
  assert.equal(normalizeSlackMrkdwn(input), "*Run* `/invite` in a channel");
});

test("converts underscore bold", () => {
  assert.equal(normalizeSlackMrkdwn("__Title__"), "*Title*");
});

test("converts asterisk list markers", () => {
  assert.equal(normalizeSlackMrkdwn("* first\n* second"), "• first\n• second");
});
