import { SkillsCatalog } from "./components/SkillsCatalog";
import { requireActiveProject } from "@/lib/auth/session";
import { getProjectDashboard } from "../queries";

export default async function SkillsPage() {
  const { projectId } = await requireActiveProject();
  const data = await getProjectDashboard(projectId);
  if (!data?.config) return null;

  return <SkillsCatalog enabled={data.config.enabledSkillIds ?? []} />;
}
