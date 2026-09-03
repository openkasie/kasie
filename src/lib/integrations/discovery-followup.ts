import { formatHumanFacts } from "@/lib/integrations/probe-insights";

function pickVariant<T>(seed: string, variants: T[]): T {
  const idx = Math.abs(seed.split("").reduce((h, c) => h + c.charCodeAt(0), 0)) % variants.length;
  return variants[idx]!;
}

function formatHighlights(
  insights: { entity: string; relation: string; target: string }[],
): string {
  const lines = formatHumanFacts(insights);
  if (lines.length === 0) {
    return "• I looked around but didn't pull out clean highlights — happy to dig deeper if you point me at something specific.";
  }
  return lines.slice(0, 6).map((l) => `• ${l}`).join("\n");
}

export function buildFallbackFollowUp(input: {
  appSlug: string;
  nickname: string;
  probeInsights?: { entity: string; relation: string; target: string }[];
}): string {
  const highlights = formatHighlights(input.probeInsights ?? []);
  const intro = pickVariant(input.nickname, [
    `I finished looking around *${input.nickname}* — here's the quick version.`,
    `Okay, I've got my bearings on *${input.nickname}* now.`,
    `Done poking around *${input.nickname}* — sharing what stood out.`,
  ]);

  const closing = pickVariant(input.appSlug, [
    "I've saved the useful bits to memory, so you won't need to re-explain this setup.",
    "It's all in team memory now — just ask naturally when you need something from this connection.",
    "You're good to ask me about this connection anytime; I won't make you repeat the context.",
  ]);

  return [
    intro,
    "",
    "*Highlights*",
    highlights,
    "",
    closing,
  ].join("\n");
}

export function buildFallbackSummary(input: {
  nickname: string;
  factCount: number;
}): string {
  if (input.factCount > 0) {
    return pickVariant(input.nickname, [
      `Finished exploring *${input.nickname}* — found some useful context and saved it for us.`,
      `All set on *${input.nickname}* — I mapped what's there and tucked it into memory.`,
      `Done with *${input.nickname}* — I'll drop the highlights in this thread.`,
    ]);
  }
  return pickVariant(input.nickname, [
    `Finished exploring *${input.nickname}* — details in the thread below.`,
    `Wrapped up on *${input.nickname}* — sharing what I could find below.`,
  ]);
}
