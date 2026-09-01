import { redirect } from "next/navigation";

export default function ChannelsRedirectPage() {
  redirect("/dashboard/settings/account");
}
