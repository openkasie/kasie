import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  capHistoryByBudget,
  HISTORY_CHAR_BUDGET,
  HISTORY_OMISSION_NOTE,
} from "./history.ts";
import type { AgentMessage } from "../ai/types.ts";

function msg(role: "user" | "assistant", content: string): AgentMessage {
  return { role, content };
}

describe("capHistoryByBudget", () => {
  it("returns history unchanged when under budget", () => {
    const history = [msg("user", "hi"), msg("assistant", "hello")];
    assert.deepEqual(capHistoryByBudget(history), history);
  });

  it("returns empty history unchanged", () => {
    assert.deepEqual(capHistoryByBudget([]), []);
  });

  it("drops oldest turns first and prepends the omission note", () => {
    const history = [
      msg("user", "a".repeat(60)),
      msg("assistant", "b".repeat(60)),
      msg("user", "c".repeat(60)),
    ];
    const capped = capHistoryByBudget(history, 130);

    assert.equal(capped.length, 3);
    assert.deepEqual(capped[0], { role: "user", content: HISTORY_OMISSION_NOTE });
    assert.equal(capped[1].content, "b".repeat(60));
    assert.equal(capped[2].content, "c".repeat(60));
  });

  it("keeps only the note when even the newest turn exceeds the budget", () => {
    const history = [msg("user", "old"), msg("assistant", "x".repeat(500))];
    const capped = capHistoryByBudget(history, 100);

    assert.equal(capped.length, 1);
    assert.equal(capped[0].content, HISTORY_OMISSION_NOTE);
  });

  it("keeps everything at an exact budget boundary", () => {
    const history = [msg("user", "12345"), msg("assistant", "67890")];
    assert.deepEqual(capHistoryByBudget(history, 10), history);
  });

  it("uses the default budget constant", () => {
    const history = [
      msg("user", "x".repeat(HISTORY_CHAR_BUDGET)),
      msg("user", "recent"),
    ];
    const capped = capHistoryByBudget(history);

    assert.equal(capped.length, 2);
    assert.equal(capped[0].content, HISTORY_OMISSION_NOTE);
    assert.equal(capped[1].content, "recent");
  });
});
