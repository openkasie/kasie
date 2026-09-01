import type { ButtonHTMLAttributes, ReactNode } from "react";
import { channelTileClass } from "../utils/variants";
import { cn } from "../utils/cn";

type ChannelTileProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
  children: ReactNode;
};

export function ChannelTile({
  selected = false,
  disabled = false,
  className,
  children,
  ...props
}: ChannelTileProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(channelTileClass(selected, disabled), className)}
      aria-pressed={selected}
      {...props}
    >
      {children}
    </button>
  );
}
