import { notFound } from "next/navigation";
import { UsageOverview } from "./components/UsageOverview";
import { getUsageOverviewData, type UsageSearchParams } from "./queries";

export default async function UsageOverviewPage({
  searchParams,
}: {
  searchParams: Promise<UsageSearchParams>;
}) {
  const params = await searchParams;
  const data = await getUsageOverviewData(params);
  if (!data?.stats) notFound();

  return (
    <UsageOverview
      stats={data.stats}
      topMembers={data.topMembers}
      topProjects={data.topProjects}
      isOwner={data.isOwner}
    />
  );
}
