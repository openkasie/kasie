/**
 * Agents reply with exactly `REACT:<emoji_name>` when a reaction is the
 * natural response; delivery adds the reaction instead of posting text.
 */
const REACT_SENTINEL = /^REACT:\s*:?([a-z0-9_+'-]+):?$/i;

/** Emoji name when the text is a REACT sentinel, otherwise null. */
export function parseReactSentinel(text: string): string | null {
  const match = REACT_SENTINEL.exec(text.trim());
  return match ? match[1].toLowerCase() : null;
}
