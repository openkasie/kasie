import { listSchedules } from "@/lib/db/queries/projects";
import { requireActiveProject } from "@/lib/auth/session";
import { TaskList } from "./components/TaskList";

export default async function TasksPage() {
  const { projectId } = await requireActiveProject();
  const schedules = await listSchedules(projectId);

  return <TaskList schedules={schedules} />;
}
