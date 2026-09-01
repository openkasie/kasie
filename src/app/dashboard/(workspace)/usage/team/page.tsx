import { notFound } from "next/navigation";
import { UsageTeamTable } from "../components/UsageTeamTable";
import { getUsageTeamData, type UsageSearchParams } from "../queries";

export default async function UsageTeamPage({
  searchParams,
}: {
  searchParams: Promise<UsageSearchParams>;
}) {
  const params = await searchParams;
  const data = await getUsageTeamData(params);
  if (!data) notFound();

  return (
    <UsageTeamTable
      activeMemberCount={data.activeMemberCount}
      members={data.members}
    />
  );
}
