import type { HTMLAttributes } from "react";
import { cn } from "../utils/cn";

type HeadingProps = HTMLAttributes<HTMLHeadingElement> & {
  as?: "h1" | "h2" | "h3";
};

const sizes = {
  h1: "text-3xl font-bold tracking-tight",
  h2: "text-xl font-semibold",
  h3: "text-lg font-medium",
};

export function Heading({ as = "h2", className, ...props }: HeadingProps) {
  const Tag = as;
  return <Tag className={cn(sizes[as], "text-[var(--fg)]", className)} {...props} />;
}
