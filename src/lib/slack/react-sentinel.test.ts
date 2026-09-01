import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseReactSentinel } from "./react-sentinel.ts";

describe("parseReactSentinel", () => {
  const cases: { input: string; expected: string | null }[] = [
    { input: "REACT:thumbsup", expected: "thumbsup" },
    { input: "REACT: thumbsup", expected: "thumbsup" },
    { input: "REACT::raised_hands:", expected: "raised_hands" },
    { input: "react:eyes", expected: "eyes" },
    { input: "  REACT:+1  ", expected: "+1" },
    { input: "REACT:party-parrot", expected: "party-parrot" },
    { input: "Thanks! REACT:thumbsup", expected: null },
    { input: "REACT:thumbsup and more", expected: null },
    { input: "REACT:", expected: null },
    { input: "I will REACT:later", expected: null },
    { input: "just a normal reply", expected: null },
    { input: "", expected: null },
  ];

  for (const { input, expected } of cases) {
    it(`parses ${JSON.stringify(input)} as ${JSON.stringify(expected)}`, () => {
      assert.equal(parseReactSentinel(input), expected);
    });
  }
});
