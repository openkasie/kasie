const CODE_SPAN = /(`[^`\n]+`)/g;
const INLINE_TOKEN =
  /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|\[[^\]\n]+\]\([^)\n]+\)|<https?:[^|>\n]+\|[^>\n]+>|https?:\/\/[^\s<>()]+)/g;

export type InlineMarkdownNode =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string }
  | { type: "strike"; value: string }
  | { type: "code"; value: string }
  | { type: "link"; href: string; label: string };

/** @deprecated Use InlineMarkdownNode */
function parseToken(token: string): InlineMarkdownNode {
  if (token.startsWith("**") && token.endsWith("**")) {
    return { type: "bold", value: token.slice(2, -2) };
  }
  if (token.startsWith("*") && token.endsWith("*")) {
    return { type: "bold", value: token.slice(1, -1) };
  }
  if (token.startsWith("_") && token.endsWith("_")) {
    return { type: "italic", value: token.slice(1, -1) };
  }
  if (token.startsWith("~") && token.endsWith("~")) {
    return { type: "strike", value: token.slice(1, -1) };
  }
  if (token.startsWith("[") && token.includes("](")) {
    const closeBracket = token.indexOf("]");
    const label = token.slice(1, closeBracket);
    const href = token.slice(closeBracket + 2, -1);
    return { type: "link", href, label };
  }
  if (token.startsWith("<") && token.includes("|")) {
    const inner = token.slice(1, -1);
    const sep = inner.indexOf("|");
    return {
      type: "link",
      href: inner.slice(0, sep),
      label: inner.slice(sep + 1),
    };
  }
  return { type: "link", href: token, label: token };
}

export function parseInlineMarkdown(text: string): InlineMarkdownNode[] {
  return text.split(CODE_SPAN).flatMap((segment, index) => {
    if (index % 2 === 1) {
      return [{ type: "code" as const, value: segment.slice(1, -1) }];
    }

    const nodes: InlineMarkdownNode[] = [];
    let last = 0;
    for (const match of segment.matchAll(INLINE_TOKEN)) {
      const start = match.index ?? 0;
      if (start > last) {
        nodes.push({ type: "text", value: segment.slice(last, start) });
      }
      nodes.push(parseToken(match[0]));
      last = start + match[0].length;
    }

    if (last < segment.length) {
      nodes.push({ type: "text", value: segment.slice(last) });
    }

    return nodes;
  });
}
