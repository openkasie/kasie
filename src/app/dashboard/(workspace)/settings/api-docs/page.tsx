import { redirect } from "next/navigation";

export default function ApiDocsRedirectPage() {
  redirect("/dashboard/settings/api-keys");
}
