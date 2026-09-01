export type SettingsPageMeta = {
  title: string;
  description?: string;
};

const SETTINGS_PAGE_META: Record<string, SettingsPageMeta> = {
  "/dashboard/settings/account": {
    title: "My account",
    description: "Manage your connection and account.",
  },
  "/dashboard/settings/preferences": {
    title: "Preferences",
    description:
      "How your agent thinks and responds. Does not change your Slack app's display name or icon.",
  },
  "/dashboard/settings/workspace": {
    title: "Workspace",
    description: "Your workspace name and identifiers shown across Kasie.",
  },
  "/dashboard/settings/api-keys": {
    title: "API keys",
    description: "Org-scoped keys for programmatic agent runs.",
  },
};

export function getSettingsPageMeta(pathname: string): SettingsPageMeta {
  return (
    SETTINGS_PAGE_META[pathname] ?? {
      title: "Settings",
    }
  );
}
