import type { HTMLAttributes, ReactNode } from "react";
import { glassClass, type GlassElevation } from "../utils/variants";
import { cn } from "../utils/cn";

type GlassCardProps = HTMLAttributes<HTMLDivElement> & {
  elevation?: GlassElevation;
  children: ReactNode;
};

export function GlassCard({
  elevation = "surface",
  className,
  children,
  ...props
}: GlassCardProps) {
  return (
    <div className={cn("rounded-xl p-6", glassClass(elevation), className)} {...props}>
      {children}
    </div>
  );
}
