"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CheckIcon, PlusIcon, SignOutIcon, SunIcon } from "@phosphor-icons/react";
import { selectWorkspace, signOutAction } from "@/app/dashboard/actions";
import { Avatar } from "./Avatar";
import { Button } from "../primitives/Button";
import { cn } from "../utils/cn";

type Workspace = {
  id: string;
  name: string;
  agentName: string;
};

type WorkspaceSwitcherProps = {
  current: Workspace;
  workspaces: Workspace[];
  budget?: {
    spentLabel: string;
    capLabel: string;
    percent: number;
  } | null;
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
};

type Theme = "light" | "dark" | "system";

function storedTheme(): Theme {
  if (typeof window === "undefined") return "system";
  return (localStorage.getItem("kasie-theme") as Theme | null) ?? "system";
}

function themeLabel(theme: Theme) {
  if (theme === "dark") return "Dark";
  if (theme === "light") return "Light";
  return "System";
}

function WorkspaceMark({ name }: { name: string }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-sm font-semibold text-[var(--accent-fg)]">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function WorkspaceSwitcher({
  current,
  workspaces,
  budget,
  user,
}: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => storedTheme());
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    localStorage.setItem("kasie-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const cycleTheme = () => {
    setTheme((t) => (t === "dark" ? "light" : t === "light" ? "system" : "dark"));
  };

  const switchWorkspace = (projectId: string) => {
    if (projectId === current.id || pending) return;
    startTransition(async () => {
      await selectWorkspace(projectId);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <div ref={ref} className="relative px-2 pb-3">
      {open ? (
        <div className="absolute bottom-full left-2 right-2 z-50 mb-2 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-2 shadow-[var(--shadow-elevated)] backdrop-blur-xl">
          <div className="space-y-0.5">
            {workspaces.map((ws) => {
              const active = ws.id === current.id;
              return (
                <button
                  key={ws.id}
                  type="button"
                  disabled={pending}
                  onClick={() => switchWorkspace(ws.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-[var(--surface-subtle)]",
                    active && "ring-1 ring-[var(--border-elevated)] bg-[var(--surface-subtle)]",
                  )}
                >
                  <WorkspaceMark name={ws.name} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{ws.name}</span>
                    <span className="block truncate text-xs text-[var(--fg-muted)]">
                      {user.email}
                    </span>
                  </span>
                  {active ? (
                    <CheckIcon size={16} weight="bold" className="shrink-0 text-[var(--accent)]" />
                  ) : null}
                </button>
              );
            })}
          </div>

          <Link
            href="/dashboard/workspaces"
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center gap-3 rounded-lg border border-dashed border-[var(--border)] px-2 py-2.5 hover:bg-[var(--surface-subtle)]"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-subtle)]">
              <PlusIcon size={16} className="text-[var(--fg-muted)]" />
            </span>
            <span className="text-sm font-medium">Add workspace</span>
          </Link>

          {budget ? (
            <div className="mt-2 border-t border-[var(--border-subtle)] px-2 pt-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--fg-muted)]">This month</span>
                <span className="font-mono font-semibold tabular-nums">
                  {budget.spentLabel} / {budget.capLabel}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-subtle)]">
                <div
                  className="h-full rounded-full bg-[var(--accent)]"
                  style={{ width: `${budget.percent}%` }}
                />
              </div>
            </div>
          ) : null}

          <div className="mt-2 border-t border-[var(--border-subtle)] pt-1">
            <button
              type="button"
              onClick={cycleTheme}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-[var(--fg-muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--fg)]"
            >
              <SunIcon size={18} />
              Theme: {themeLabel(theme)}
            </button>
            <form action={signOutAction}>
              <Button type="submit" variant="ghost" className="w-full justify-start px-2">
                <SignOutIcon size={18} />
                Sign out
              </Button>
            </form>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-[var(--surface-subtle)]"
        aria-current={pathname.startsWith("/dashboard") ? "page" : undefined}
      >
        <span className="relative shrink-0">
          <Avatar name={user.name} image={user.image} size="md" />
          <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded bg-[var(--accent)] text-[9px] font-bold text-[var(--accent-fg)] ring-2 ring-[var(--bg)]">
            {current.name.slice(0, 1).toUpperCase()}
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {user.name ?? "User"}
          </span>
          <span className="block truncate text-xs text-[var(--fg-muted)]">
            {user.email}
          </span>
        </span>
      </button>
    </div>
  );
}
