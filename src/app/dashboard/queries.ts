import { cache } from "react";
import { listProjectsForUser } from "@/lib/db/queries/orgs";
import { listProjects } from "@/lib/db/queries/projects";

export const getProjectsForUser = cache(
  async (userId: string, isSuperadmin: boolean) =>
    isSuperadmin ? listProjects() : listProjectsForUser(userId),
);
