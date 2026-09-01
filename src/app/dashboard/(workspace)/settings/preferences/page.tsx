import { requireActiveProject } from "@/lib/auth/session";
import { getProjectDashboard } from "../../queries";
import { PreferencesForm } from "../components/PreferencesForm";
import { buildModelTierPresets } from "../model-tiers";

export default async function PreferencesSettingsPage() {
  const { projectId } = await requireActiveProject();
  const data = await getProjectDashboard(projectId);
  if (!data?.config) return null;

  return (
    <PreferencesForm
      tone={data.config.personalityTone}
      instructions={data.config.workspaceInstructions ?? ""}
      modelTier={data.config.modelTier ?? "smart"}
      tierPresets={await buildModelTierPresets()}
    />
  );
}
