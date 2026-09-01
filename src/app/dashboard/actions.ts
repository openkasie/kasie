"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { signOut } from "@/auth";
import { requireProjectAccess, requireSession, setSelectedProject } from "@/lib/auth/session";

export async function signOutAction() {
  await signOut({ redirectTo: "/sign-in" });
}

export async function selectWorkspace(projectId: string) {
  const session = await requireSession();
  await requireProjectAccess(projectId);
  await setSelectedProject(session.user.id, projectId);
  revalidatePath("/dashboard", "layout");
}

export async function selectWorkspaceAndRedirect(projectId: string) {
  const session = await requireSession();
  await requireProjectAccess(projectId);
  await setSelectedProject(session.user.id, projectId);
  redirect("/dashboard");
}
