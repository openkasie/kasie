import { PageSkeleton } from "@/design-system";

export default function WorkspaceLoading() {
  return <PageSkeleton stats={4} panels={2} rows={4} />;
}
