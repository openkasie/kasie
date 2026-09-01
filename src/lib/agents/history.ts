// Relative .ts import keeps this module loadable by the node:test runner,
// which has no @/ alias resolution.
import type { AgentMessage } from "../ai/types.ts";

/** Rough prompt budget for prior turns; newest turns win. */
export const HISTORY_CHAR_BUDGET = 8_000;

export const HISTORY_OMISSION_NOTE =
  "[note] Earlier messages in this thread were omitted to stay within the context budget.";

/**
 * Trim history to a character budget, dropping oldest turns first. When
 * anything is dropped, a single note marks the omission so the model knows
 * the thread started earlier than what it sees.
 */
export function capHistoryByBudget(
  messages: AgentMessage[],
  budget = HISTORY_CHAR_BUDGET,
): AgentMessage[] {
  let used = 0;
  let firstKept = messages.length;

  for (let i = messages.length - 1; i >= 0; i--) {
    const cost = messages[i].content.length;
    if (used + cost > budget) break;
    used += cost;
    firstKept = i;
  }

  if (firstKept === 0) return messages;

  return [
    { role: "user", content: HISTORY_OMISSION_NOTE },
    ...messages.slice(firstKept),
  ];
}
