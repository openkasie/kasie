import { UsageNav } from "./components/UsageNav";
import { UsagePageHeader } from "./components/UsagePageHeader";
import { getUsageContext } from "./queries";

export default async function UsageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getUsageContext({});

  return (
    <div className="space-y-6">
      <UsagePageHeader isOwner={ctx?.isOwner ?? false} />
      <UsageNav />
      {children}
    </div>
  );
}
