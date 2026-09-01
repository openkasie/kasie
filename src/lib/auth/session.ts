import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  hasProjectAccess,
  listProjectsForUser,
  setUserSelectedProject,
} from "@/lib/db/queries/orgs";
import { listProjects } from "@/lib/db/queries/projects";

export const requireSession = cache(async () => {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  return session;
});

async function firstAccessibleProjectId(userId: string, isSuperadmin: boolean) {
  const projects = isSuperadmin
    ? await listProjects()
    : await listProjectsForUser(userId);
  return projects[0]?.id ?? null;
}

async function canAccessProject(
  userId: string,
  isSuperadmin: boolean,
  projectId: string,
) {
  if (isSuperadmin) return true;
  return hasProjectAccess(userId, projectId);
}

export async function setSelectedProject(userId: string, projectId: string) {
  const session = await auth();
  const isSuperadmin = session?.user.isSuperadmin ?? false;
  if (!(await canAccessProject(userId, isSuperadmin, projectId))) {
    throw new Error("forbidden");
  }
  await setUserSelectedProject(userId, projectId);
}

export async function getActiveProjectId() {
  const session = await requireSession();
  const { id: userId, isSuperadmin, selectedProjectId } = session.user;

  if (
    selectedProjectId &&
    (await canAccessProject(userId, isSuperadmin, selectedProjectId))
  ) {
    return selectedProjectId;
  }

  const fallbackId = await firstAccessibleProjectId(userId, isSuperadmin);
  if (!fallbackId) return null;

  if (selectedProjectId !== fallbackId) {
    await setUserSelectedProject(userId, fallbackId);
  }

  return fallbackId;
}
export const requireActiveProject = cache(async () => {
  const session = await requireSession();
  const projectId = await getActiveProjectId();
  if (!projectId) redirect("/onboarding");

  if (session.user.selectedProjectId !== projectId) {
    session.user.selectedProjectId = projectId;
  }

  return { session, projectId };
});

// Org members see every project in their org; superadmin sees all.
export const requireProjectAccess = cache(async (projectId: string) => {
  const session = await requireSession();
  if (session.user.isSuperadmin) return session;
  if (!(await hasProjectAccess(session.user.id, projectId))) {
    redirect("/dashboard");
  }
  return session;
});
