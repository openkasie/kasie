import { notFound } from "next/navigation";
import { UsageTasksTable } from "../components/UsageTasksTable";
import { getUsageTasksData, type UsageSearchParams } from "../queries";

export default async function UsageTasksPage({
  searchParams,
}: {
  searchParams: Promise<UsageSearchParams>;
}) {
  const params = await searchParams;
  const data = await getUsageTasksData(params);
  if (!data) notFound();

  return <UsageTasksTable schedules={data.schedules} initiative={data.initiative} />;
}
