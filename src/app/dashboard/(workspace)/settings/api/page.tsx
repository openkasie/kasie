import { redirect } from "next/navigation";

export default function ApiQuickStartRedirectPage() {
  redirect("/dashboard/settings/api-keys");
}
