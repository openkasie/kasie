import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { inferDialect } from "./dialect.ts";

describe("inferDialect", () => {
  const cases: Array<{
    id: string;
    ownedBy?: string | null;
    expected: ReturnType<typeof inferDialect>;
  }> = [
      { id: "gpt-4.1", ownedBy: "openai", expected: "openai" },
      { id: "o3-mini", ownedBy: "openai", expected: "openai" },
      { id: "text-embedding-3-small", expected: "openai" },
      { id: "claude-sonnet-4-20250514", ownedBy: "anthropic", expected: "anthropic" },
      { id: "anthropic/claude-sonnet-4.6", expected: "anthropic" },
      { id: "gemini-2.5-flash", ownedBy: "google", expected: "google" },
      { id: "meta/llama-3.3-70b", expected: "meta" },
      { id: "mistral-large", expected: "mistral" },
      { id: "codestral-latest", expected: "mistral" },
      { id: "some-unknown-model", expected: "unknown" },
    ];

  for (const { id, ownedBy, expected } of cases) {
    test(`${id} → ${expected}`, () => {
      assert.equal(inferDialect(id, ownedBy), expected);
    });
  }
});
