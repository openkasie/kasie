import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { countUsers } from "@/lib/db/queries/orgs";
import { Button, GlassCard, Heading } from "@/design-system";
import { hasGithubAuth, hasGoogleAuth, hasSlackOAuth } from "@/lib/env";
import { signInWithProvider, signInWithSlack } from "./actions";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");
  if ((await countUsers()) === 0) redirect("/onboarding");

  const { error } = await searchParams;
  const google = hasGoogleAuth();
  const github = hasGithubAuth();
  const slack = hasSlackOAuth();

  const errorMessage =
    error === "invite-only" || error === "AccessDenied"
      ? "Your account has not been invited yet. Contact your administrator."
      : null;

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-sm flex-col justify-center px-6 py-10">
      <GlassCard elevation="elevated" className="space-y-6">
        <div className="space-y-1">
          <Heading as="h1">Sign in</Heading>
          <p className="text-sm text-[var(--fg-muted)]">
            Access is invite-only. Use the same email as your workspace account.
          </p>
        </div>

        {errorMessage ? (
          <p className="rounded-lg bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger-fg)]">
            {errorMessage}
          </p>
        ) : null}

        {slack ? (
          <form
            action={async () => {
              "use server";
              await signInWithSlack();
            }}
          >
            <Button variant="contrast" className="w-full" type="submit">
              Continue with Slack
            </Button>
          </form>
        ) : null}

        {google ? (
          <form
            action={async () => {
              "use server";
              await signInWithProvider("google");
            }}
          >
            <Button variant="secondary" className="w-full" type="submit">
              Continue with Google
            </Button>
          </form>
        ) : null}

        {github ? (
          <form
            action={async () => {
              "use server";
              await signInWithProvider("github");
            }}
          >
            <Button variant="secondary" className="w-full" type="submit">
              Continue with GitHub
            </Button>
          </form>
        ) : null}

        {!google && !github && !slack ? (
          <p className="text-sm text-[var(--fg-muted)]">
            No sign-in providers are configured. Set Slack, Google, or GitHub
            OAuth credentials in the environment.
          </p>
        ) : null}
      </GlassCard>
    </div>
  );
}
