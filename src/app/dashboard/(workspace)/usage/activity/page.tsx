import { notFound } from "next/navigation";
import { Suspense } from "react";
import { UsageActivityFeed } from "../components/UsageActivityFeed";
import { getUsageActivityData, type UsageSearchParams } from "../queries";

export default async function UsageActivityPage({
  searchParams,
}: {
  searchParams: Promise<UsageSearchParams>;
}) {
  const params = await searchParams;
  const data = await getUsageActivityData(params);
  if (!data) notFound();

  return (
    <Suspense fallback={null}>
      <UsageActivityFeed
        events={data.events}
        members={data.members}
        projects={data.projects}
        isOwner={data.isOwner}
        page={data.page}
        hasNext={data.hasNext}
      />
    </Suspense>
  );
}
