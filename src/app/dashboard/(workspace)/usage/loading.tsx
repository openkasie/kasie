import { PageSkeleton } from "@/design-system";

export default function UsageLoading() {
  return <PageSkeleton header={false} stats={3} chart panels={2} />;
}
