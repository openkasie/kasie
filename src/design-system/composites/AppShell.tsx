"use client";

import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { ListIcon, XIcon } from "@phosphor-icons/react";
import { cn } from "../utils/cn";

type AppShellProps = {
  /** Full sidebar content (logo header, nav, footer) shared by desktop rail and mobile drawer. */
  sidebar: ReactNode;
  /** Compact brand shown in the mobile top bar. */
  logo: ReactNode;
  children: ReactNode;
};

export function AppShell({ sidebar, logo, children }: AppShellProps) {
  const [open, setOpen] = useState(false);

  // Close the drawer when a navigation control inside it is activated.
  const closeOnNavigate = (e: MouseEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest("a")) setOpen(false);
  };

  // Escape closes the drawer; lock scroll while it is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Desktop rail */}
      <aside className="hidden w-[var(--sidebar-width)] shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--surface-subtle)] lg:flex">
        {sidebar}
      </aside>

      {/* Mobile drawer + backdrop */}
      <div className={cn("lg:hidden", open ? "" : "pointer-events-none")}>
        <div
          aria-hidden
          onClick={() => setOpen(false)}
          className={cn(
            "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-[var(--duration)] motion-reduce:transition-none",
            open ? "opacity-100" : "opacity-0",
          )}
        />
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-[min(85vw,var(--sidebar-width))] flex-col border-r border-[var(--border)] bg-[var(--surface-solid)] shadow-[var(--shadow-elevated)]",
            "transition-transform duration-[var(--duration)] ease-[var(--ease-out)] motion-reduce:transition-none",
            open ? "translate-x-0" : "-translate-x-full",
          )}
          aria-hidden={!open}
          onClick={closeOnNavigate}
        >
          {sidebar}
        </aside>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg)]/80 px-4 py-3 backdrop-blur-xl lg:hidden">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            {open ? <XIcon size={20} /> : <ListIcon size={20} />}
          </button>
          {logo}
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
