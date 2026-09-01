"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { XIcon } from "@phosphor-icons/react";
import { cn } from "../utils/cn";

type ModalSize = "sm" | "md" | "lg" | "xl";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
  size?: ModalSize;
  showClose?: boolean;
};

const SIZES: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
};

export function Modal({
  open,
  onClose,
  children,
  className,
  title,
  description,
  size = "lg",
  showClose,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const withChrome = Boolean(title || description || showClose);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Lock background scroll while the modal is open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={title ? "ds-modal-title" : undefined}
      className={cn(
        "fixed inset-0 z-50 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-solid)] p-0 text-[var(--fg)] shadow-[var(--shadow-elevated)]",
        "backdrop:bg-black/60 backdrop:backdrop-blur-sm",
        "open:ds-animate-in",
        SIZES[size],
        className,
      )}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      {withChrome ? (
        <div className="flex flex-col">
          <div className="flex items-start justify-between gap-4 px-6 pt-6">
            <div className="min-w-0 space-y-1">
              {title ? (
                <h2 id="ds-modal-title" className="text-lg font-semibold tracking-tight">
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p className="text-sm text-[var(--fg-muted)]">{description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-1.5 -mt-1.5 grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-elevated)] hover:text-[var(--fg)] active:bg-[var(--surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              <XIcon size={18} />
            </button>
          </div>
          <div className="px-6 pb-6 pt-4">{children}</div>
        </div>
      ) : (
        children
      )}
    </dialog>
  );
}
