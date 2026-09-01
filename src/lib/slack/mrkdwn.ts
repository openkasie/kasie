const CODE_SPAN = /(`[^`]*`)/g;

function transformOutsideCode(text: string): string {
  return text
    .replace(/\*\*([^*\n]+)\*\*/g, "*$1*")
    .replace(/__([^_\n]+)__/g, "*$1*")
    .replace(/^[\t ]*[-*]\s+/gm, "• ");
}

export function normalizeSlackMrkdwn(text: string): string {
  return text
    .split(CODE_SPAN)
    .map((segment, index) =>
      index % 2 === 1 ? segment : transformOutsideCode(segment),
    )
    .join("");
}
