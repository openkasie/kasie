import { Fragment, type ReactNode } from "react";
import { parseInlineMarkdown, type InlineMarkdownNode } from "./parse-mrkdwn";

function renderInline(nodes: InlineMarkdownNode[]): ReactNode[] {
  return nodes.map((node, index) => {
    switch (node.type) {
      case "text":
        return <Fragment key={index}>{node.value}</Fragment>;
      case "bold":
        return (
          <strong key={index} className="font-medium text-[var(--fg)]">
            {node.value}
          </strong>
        );
      case "italic":
        return <em key={index}>{node.value}</em>;
      case "strike":
        return <s key={index}>{node.value}</s>;
      case "code":
        return (
          <code
            key={index}
            className="rounded-md bg-[var(--surface-subtle)] px-1.5 py-0.5 font-mono text-[0.8125rem] text-[var(--fg)]"
          >
            {node.value}
          </code>
        );
      case "link":
        return (
          <a
            key={index}
            href={node.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent)] underline underline-offset-2 hover:opacity-90"
          >
            {node.label}
          </a>
        );
    }
  });
}

type InlineMarkdownProps = {
  text: string;
  className?: string;
};

export function InlineMarkdown({ text, className }: InlineMarkdownProps) {
  return <span className={className}>{renderInline(parseInlineMarkdown(text))}</span>;
}

type SlackMrkdwnProps = {
  text: string;
  className?: string;
};

export function SlackMrkdwn({ text, className }: SlackMrkdwnProps) {
  const lines = text.split("\n");

  return (
    <div className={className ?? "space-y-1.5 text-sm leading-relaxed text-[var(--fg-muted)]"}>
      {lines.map((line, lineIndex) => {
        const trimmed = line.trimEnd();
        if (!trimmed) return <div key={lineIndex} className="h-2" aria-hidden />;

        const isBullet = trimmed.startsWith("•");
        const content = isBullet ? trimmed.slice(1).trimStart() : trimmed;

        return (
          <p key={lineIndex} className={isBullet ? "flex gap-2 pl-0.5" : undefined}>
            {isBullet ? (
              <span aria-hidden className="select-none text-[var(--fg-muted)]">
                •
              </span>
            ) : null}
            <span className="min-w-0 flex-1">{renderInline(parseInlineMarkdown(content))}</span>
          </p>
        );
      })}
    </div>
  );
}
