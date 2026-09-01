import { tool } from "ai";
import { z } from "zod";
import { storeMemoryTriple } from "@/lib/embeddings/memory";

/**
 * First-class memory write for the agent. Classified as "read" by the tool
 * policy (internal DB write, no external side effects), so it executes
 * without HITL approval.
 */
export function buildRememberTool(projectId: string) {
  return tool({
    description: [
      "Store a durable fact in team memory as an entity/relation/target triple.",
      "Use whenever you learn something worth recalling later: who owns what,",
      "personal preferences, decisions, deadlines, recurring rituals.",
      'For facts about a person, use entity "person:<name>" (e.g. person:dana / prefers / short bullet summaries).',
      "Do not store transient conversation details.",
    ].join(" "),
    inputSchema: z.object({
      entity: z
        .string()
        .min(1)
        .max(200)
        .describe('Subject of the fact, e.g. "person:dana", "project:billing", "team"'),
      relation: z
        .string()
        .min(1)
        .max(100)
        .describe('Verb linking entity to target, e.g. "owns", "prefers", "decided"'),
      target: z
        .string()
        .min(1)
        .max(500)
        .describe("The fact itself"),
    }),
    execute: async ({ entity, relation, target }) => {
      await storeMemoryTriple({ projectId, entity, relation, target });
      return { stored: true, fact: `${entity} ${relation} ${target}` };
    },
  });
}
