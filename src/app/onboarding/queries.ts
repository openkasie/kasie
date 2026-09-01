import { cache } from "react";
import { countUsers, listProjectsForUser } from "@/lib/db/queries/orgs";
import { listProjects } from "@/lib/db/queries/projects";

export const isBootstrapNeeded = cache(async () => (await countUsers()) === 0);

export const getOnboardingProjects = cache(
  async (userId: string, isSuperadmin: boolean) => {
    return isSuperadmin
      ? listProjects()
      : listProjectsForUser(userId);
  },
);
