import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { setSelectedProject } from "@/lib/auth/session";
import { getProjectConfig, isPendingPlatformTeam } from "@/lib/db/queries/projects";
import { hasSlackOAuth } from "@/lib/env";
import { resolveAppOrigin } from "@/lib/slack/redirect-uri";
import { isChannelId, type ChannelId } from "./channels";
import { getConfiguredChannelIds } from "./channel-config";
import { OnboardingWizard } from "./components/OnboardingWizard";
import {
  getOnboardingProjects,
  isBootstrapNeeded,
} from "./queries";

export const metadata = {
  title: "Set up Kasie",
  description: "Connect Kasie to the place your team already talks.",
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{
    preview?: string;
    error?: string;
    email?: string;
    workspace?: string;
    channel?: string;
  }>;
}) {
  const {
    preview: previewParam,
    error: errorParam,
    email: draftEmail,
    workspace: draftWorkspace,
    channel: draftChannel,
  } = await searchParams;
  const preview =
    previewParam === "1" && process.env.NODE_ENV === "development";

  const session = await auth();
  const bootstrap = await isBootstrapNeeded();

  if (!session?.user && !bootstrap && !preview) redirect("/sign-in");

  const headerList = await headers();
  const host =
    headerList.get("x-forwarded-host") ??
    headerList.get("host") ??
    "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const origin = resolveAppOrigin(`${proto}://${host}`);

  let phase: "bootstrap" | "workspace" | "connect" = "bootstrap";
  let projectId: string | undefined;
  let initialChannel: ChannelId | undefined;
  let workspaceName: string | undefined;

  if (session?.user && !preview) {
    const projects = await getOnboardingProjects(
      session.user.id,
      session.user.isSuperadmin,
    );
    const pending = projects.find((p) =>
      isPendingPlatformTeam(p.platformTeamId),
    );
    const ready = projects.find(
      (p) => !isPendingPlatformTeam(p.platformTeamId),
    );

    if (ready && !pending) {
      await setSelectedProject(session.user.id, ready.id);
      redirect("/dashboard");
    }

    if (pending) {
      phase = "connect";
      projectId = pending.id;
      workspaceName = pending.name;
      const config = await getProjectConfig(pending.id);
      const primary = config?.channelBindings?.primary;
      if (primary && isChannelId(primary)) initialChannel = primary;
    } else {
      phase = "workspace";
    }
  }

  if (preview) phase = "bootstrap";

  const slackError =
    errorParam === "slack-taken"
      ? "That Slack workspace is already bound to another tenant."
      : errorParam === "slack-email"
        ? "Use the Slack account that matches your work email."
        : errorParam === "slack-signin"
          ? "Slack sign-in failed. Try again."
          : errorParam === "slack-session"
            ? "Sign-in did not persist before Slack install. Connect Slack again."
            : errorParam
              ? "Slack connection failed. Try again."
              : undefined;

  const configuredChannels = getConfiguredChannelIds();

  return (
    <OnboardingWizard
      phase={phase}
      slackOAuthReady={hasSlackOAuth()}
      configuredChannels={configuredChannels}
      origin={origin}
      initialChannel={
        draftChannel && isChannelId(draftChannel)
          ? draftChannel
          : initialChannel
      }
      projectId={projectId}
      workspaceName={draftWorkspace ?? workspaceName}
      initialError={slackError}
      errorCode={errorParam}
      userEmail={draftEmail ?? session?.user?.email ?? undefined}
      preview={preview}
    />
  );
}
