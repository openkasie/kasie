import assert from "node:assert/strict";
import { test } from "node:test";
import { parseInlineMarkdown } from "./parse-mrkdwn.ts";

test("parseInlineMarkdown handles slack bold and code", () => {
  const nodes = parseInlineMarkdown(
    "*GitHub connected:* Profile *Nicholas P.* (`nicholasjpanella`)",
  );

  assert.deepEqual(nodes, [
    { type: "bold", value: "GitHub connected:" },
    { type: "text", value: " Profile " },
    { type: "bold", value: "Nicholas P." },
    { type: "text", value: " (" },
    { type: "code", value: "nicholasjpanella" },
    { type: "text", value: ")" },
  ]);
});

test("parseInlineMarkdown handles slack links", () => {
  const nodes = parseInlineMarkdown("See <https://github.com|GitHub> for details.");
  assert.deepEqual(nodes, [
    { type: "text", value: "See " },
    { type: "link", href: "https://github.com", label: "GitHub" },
    { type: "text", value: " for details." },
  ]);
});

test("parseInlineMarkdown handles GitHub bold, code, and links", () => {
  const nodes = parseInlineMarkdown(
    'Find pull requests with a certain state. Only supports values of `open`, `closed`. [See the documentation](https://docs.github.com/en/rest/pulls/pulls#list-pull-requests)',
  );

  assert.deepEqual(nodes, [
    { type: "text", value: "Find pull requests with a certain state. Only supports values of " },
    { type: "code", value: "open" },
    { type: "text", value: ", " },
    { type: "code", value: "closed" },
    { type: "text", value: ". " },
    {
      type: "link",
      href: "https://docs.github.com/en/rest/pulls/pulls#list-pull-requests",
      label: "See the documentation",
    },
  ]);
});

test("parseInlineMarkdown handles GitHub double-asterisk bold", () => {
  const nodes = parseInlineMarkdown("**Get Pull Request** for a repository.");
  assert.deepEqual(nodes, [
    { type: "bold", value: "Get Pull Request" },
    { type: "text", value: " for a repository." },
  ]);
});
