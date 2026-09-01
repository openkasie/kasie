"use client";

import { useMemo, useState, useTransition } from "react";
import { WrenchIcon } from "@phosphor-icons/react";
import { Button, EmptyState, GlassCard, PageHeader, SearchInput, Tabs } from "@/design-system";
import { sanitizeEnabledSkillIds, SKILL_PRESETS } from "@/lib/skills/catalog";
import { toggleSkill } from "../../actions";

type SkillsCatalogProps = {
  enabled: string[];
};

export function SkillsCatalog({ enabled }: SkillsCatalogProps) {
  const [tab, setTab] = useState<"enabled" | "catalog">("enabled");
  const [query, setQuery] = useState("");
  const [pending, start] = useTransition();
  const enabledSet = useMemo(
    () => new Set(sanitizeEnabledSkillIds(enabled)),
    [enabled],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list =
      tab === "enabled"
        ? SKILL_PRESETS.filter((s) => enabledSet.has(s.id))
        : SKILL_PRESETS;
    if (!q) return list;
    return list.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q),
    );
  }, [query, tab, enabledSet]);

  const enabledCount = SKILL_PRESETS.filter((s) => enabledSet.has(s.id)).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Skills"
        description="Enable optional skill presets for your agent."
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          tabs={[
            { id: "enabled", label: "Enabled", count: enabledCount },
            { id: "catalog", label: "Catalog", count: SKILL_PRESETS.length },
          ]}
          active={tab}
          onChange={(id) => setTab(id as "enabled" | "catalog")}
        />
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search skills"
          className="sm:max-w-xs"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<WrenchIcon size={32} weight="regular" />}
          title={tab === "enabled" ? "No skills enabled yet" : "No skills match your search"}
          description={
            tab === "enabled"
              ? "Browse the catalog and enable skills for your agent."
              : "Try a different search term."
          }
          action={
            tab === "enabled" ? (
              <Button variant="secondary" onClick={() => setTab("catalog")}>
                Browse catalog
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((skill) => {
            const isEnabled = enabledSet.has(skill.id);
            return (
              <GlassCard key={skill.id} elevation="subtle" className="flex flex-col justify-between p-4">
                <div>
                  <p className="font-medium">{skill.label}</p>
                  <p className="mt-1 text-sm text-[var(--fg-muted)]">{skill.description}</p>
                </div>
                <Button
                  variant={isEnabled ? "primary" : "secondary"}
                  disabled={pending}
                  className="mt-4 self-start"
                  onClick={() =>
                    start(async () => {
                      await toggleSkill({
                        skillId: skill.id,
                        enabled: !isEnabled,
                      });
                    })
                  }
                >
                  {isEnabled ? "Enabled" : "Enable"}
                </Button>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
