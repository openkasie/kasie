"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Icon } from "@phosphor-icons/react";
import {
  ArrowLeftIcon,
  BrainIcon,
  BuildingsIcon,
  CalendarCheckIcon,
  ChartBarIcon,
  GearIcon,
  HouseIcon,
  KeyIcon,
  PlayIcon,
  PlugIcon,
  ShieldCheckIcon,
  SlidersIcon,
  UserIcon,
  UsersIcon,
  WrenchIcon,
} from "@phosphor-icons/react";
import { cn } from "../utils/cn";

type NavItemConfig = {
  href: string;
  label: string;
  icon: Icon;
  badge?: number;
};

type SettingsNavSection = {
  label: string;
  items: Omit<NavItemConfig, "badge">[];
};

const PROJECT_NAV: Omit<NavItemConfig, "badge">[] = [
  { href: "/dashboard", label: "Dashboard", icon: HouseIcon },
  { href: "/dashboard/integrations", label: "Integrations", icon: PlugIcon },
  { href: "/dashboard/skills", label: "Skills", icon: WrenchIcon },
  { href: "/dashboard/tasks", label: "Tasks", icon: CalendarCheckIcon },
  { href: "/dashboard/approvals", label: "Approvals", icon: ShieldCheckIcon },
  { href: "/dashboard/memory", label: "Memory", icon: BrainIcon },
  { href: "/dashboard/runs", label: "Runs", icon: PlayIcon },
  { href: "/dashboard/team", label: "Team", icon: UsersIcon },
  { href: "/dashboard/usage", label: "Usage", icon: ChartBarIcon },
  { href: "/dashboard/settings", label: "Settings", icon: GearIcon },
];

const SETTINGS_NAV_SECTIONS: SettingsNavSection[] = [
  {
    label: "Personal",
    items: [
      { href: "/dashboard/settings/account", label: "My account", icon: UserIcon },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/dashboard/settings/preferences", label: "Preferences", icon: SlidersIcon },
      { href: "/dashboard/settings/workspace", label: "Workspace", icon: BuildingsIcon },
    ],
  },
  {
    label: "API",
    items: [
      { href: "/dashboard/settings/api-keys", label: "API keys", icon: KeyIcon },
    ],
  },
];

const SIDEBAR_PANEL =
  "flex flex-1 flex-col gap-0.5 px-2 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none";

type NavItemProps = {
  href: string;
  label: string;
  icon: Icon;
  badge?: number;
};

function NavItem({ href, label, icon: Icon, badge }: NavItemProps) {
  const pathname = usePathname();
  const active =
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
        active
          ? "bg-[var(--surface)] text-[var(--fg)] ring-1 ring-[var(--border)]"
          : "text-[var(--fg-muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--fg)]",
      )}
    >
      <Icon size={18} weight={active ? "fill" : "regular"} className="shrink-0" />
      <span className="flex-1">{label}</span>
      {badge != null && badge > 0 ? (
        <span className="rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-xs font-medium text-[var(--accent-fg)]">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

type SidebarNavProps = {
  pendingCount: number;
};

function SettingsNavHeader() {
  return (
    <Link
      href="/dashboard"
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--fg)]"
    >
      <ArrowLeftIcon size={16} className="shrink-0" />
      <span>Settings</span>
    </Link>
  );
}

export function SidebarNav({ pendingCount }: SidebarNavProps) {
  const pathname = usePathname();
  const inSettings = pathname.startsWith("/dashboard/settings");

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden py-4">
      <nav
        aria-hidden={inSettings}
        className={cn(
          SIDEBAR_PANEL,
          inSettings
            ? "pointer-events-none absolute inset-0 -translate-x-3 opacity-0"
            : "relative translate-x-0 opacity-100",
        )}
      >
        {PROJECT_NAV.map((item) => (
          <NavItem
            key={item.href}
            {...item}
            badge={item.label === "Approvals" ? pendingCount : undefined}
          />
        ))}
      </nav>

      <nav
        aria-hidden={!inSettings}
        className={cn(
          SIDEBAR_PANEL,
          inSettings
            ? "relative translate-x-0 opacity-100"
            : "pointer-events-none absolute inset-0 translate-x-3 opacity-0",
        )}
      >
        <SettingsNavHeader />
        <div
          aria-hidden
          className="mx-2 mt-2 mb-3 border-t border-[var(--border-subtle)]"
        />
        <div className="flex flex-col gap-4 overflow-y-auto">
          {SETTINGS_NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              <p className="mb-1 px-3 text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
                {section.label}
              </p>
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => (
                  <NavItem key={item.href} {...item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </nav>
    </div>
  );
}
