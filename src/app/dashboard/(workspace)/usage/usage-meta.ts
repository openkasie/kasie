export const USAGE_TABS = [
  { href: "/dashboard/usage", label: "Overview" },
  { href: "/dashboard/usage/team", label: "Team" },
  { href: "/dashboard/usage/activity", label: "Activity" },
  { href: "/dashboard/usage/tasks", label: "Tasks" },
] as const;

export function getUsagePageMeta(pathname: string) {
  if (pathname.startsWith("/dashboard/usage/team")) {
    return {
      title: "Usage",
      description: "Per-member estimated spend and run activity for your organization.",
    };
  }
  if (pathname.startsWith("/dashboard/usage/activity")) {
    return {
      title: "Usage",
      description:
        "Review operational activity and audit events. Owners also see admin and security changes.",
    };
  }
  if (pathname.startsWith("/dashboard/usage/tasks")) {
    return {
      title: "Usage",
      description: "Scheduled task runs and estimated cost over the selected range.",
    };
  }
  return {
    title: "Usage",
    description: "Estimated model cost and activity for your organization.",
  };
}
