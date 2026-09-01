export type ProbeStep = {
  toolName: string;
  args?: Record<string, unknown>;
};

const PROBE_MAP: Record<string, ProbeStep[]> = {
  github: [
    { toolName: "github-get-current-user" },
    { toolName: "github-list-repos-for-authenticated-user" },
  ],
  datadog: [{ toolName: "datadog-list-monitors" }],
  vercel: [{ toolName: "vercel-list-projects" }],
  neon: [{ toolName: "neon-list-projects" }],
  gmail: [{ toolName: "gmail-list-labels" }],
  google_sheets: [{ toolName: "google_sheets-list-spreadsheets" }],
};

export function probeStepsForApp(appSlug: string, discoveredToolNames: string[]): ProbeStep[] {
  const mapped = PROBE_MAP[appSlug.replace(/-/g, "_")];
  if (mapped) {
    return mapped.filter((step) => discoveredToolNames.includes(step.toolName));
  }

  const readTools = discoveredToolNames
    .filter((name) => /\b(list|get|search|find|retrieve|query|fetch|read|show|describe)\b/i.test(name))
    .slice(0, 2);

  return readTools.map((toolName) => ({ toolName }));
}
