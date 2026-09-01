import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { countUsers } from "@/lib/db/queries/orgs";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");
  if ((await countUsers()) === 0) redirect("/onboarding");
  redirect("/sign-in");
}
