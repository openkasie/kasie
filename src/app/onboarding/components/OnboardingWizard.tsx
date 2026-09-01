"use client";

import { useState, useTransition } from "react";
import { ArrowRightIcon, CheckIcon } from "@phosphor-icons/react";
import { Button, ChannelTile, Heading, Input, Label } from "@/design-system";
import {
  CHANNELS,
  channelLabel,
  type ChannelId,
} from "../channels";
import {
  createWorkspace,
  skipChannelConnect,
  startSlackOAuth,
  startSlackOnboardingConnect,
} from "../actions";
import { ChannelMark, KasieMark } from "./ChannelMark";
import { ProgressHeader } from "./ProgressHeader";
import { EmailStepSchema } from "../schemas";

type WizardPhase = "bootstrap" | "workspace" | "connect";

export type OnboardingWizardProps = {
  phase: WizardPhase;
  slackOAuthReady: boolean;
  configuredChannels: ChannelId[];
  origin: string;
  initialChannel?: ChannelId;
  projectId?: string;
  workspaceName?: string;
  userEmail?: string;
  initialError?: string;
  errorCode?: string;
  preview?: boolean;
};

type Step = "channel" | "workspace" | "email" | "connect";

function stepsFor(phase: WizardPhase): Step[] {
  if (phase === "bootstrap") return ["channel", "workspace", "email", "connect"];
  if (phase === "workspace") return ["channel", "workspace", "connect"];
  return ["connect"];
}

function stepForError(
  phase: WizardPhase,
  errorCode?: string,
  draft?: { workspace?: string; email?: string },
): Step | undefined {
  const sequence = stepsFor(phase);
  if (!errorCode) return undefined;

  const workspaceOk = (draft?.workspace?.trim().length ?? 0) >= 2;

  if (errorCode === "slack-email" && sequence.includes("email")) {
    if (!workspaceOk && sequence.includes("workspace")) return "workspace";
    return "email";
  }

  if (
    errorCode === "slack-signin" ||
    errorCode === "slack-taken" ||
    errorCode === "slack"
  ) {
    if (!workspaceOk && sequence.includes("workspace")) return "workspace";
    if (sequence.includes("connect")) return "connect";
  }

  return undefined;
}

function defaultChannel(
  configured: ChannelId[],
  preferred?: ChannelId,
): ChannelId {
  if (preferred && configured.includes(preferred)) return preferred;
  return configured[0] ?? "slack";
}

export function OnboardingWizard({
  phase,
  slackOAuthReady,
  configuredChannels,
  origin,
  initialChannel = "slack",
  projectId,
  workspaceName: initialWorkspaceName = "",
  userEmail = "",
  initialError,
  errorCode,
  preview = false,
}: OnboardingWizardProps) {
  const sequence = stepsFor(phase);
  const [step, setStep] = useState<Step>(
    () =>
      stepForError(phase, errorCode, {
        workspace: initialWorkspaceName,
        email: userEmail,
      }) ?? sequence[0],
  );
  const [channel, setChannel] = useState<ChannelId>(() =>
    defaultChannel(configuredChannels, initialChannel),
  );
  const [workspaceName, setWorkspaceName] = useState(initialWorkspaceName);
  const [email, setEmail] = useState(userEmail);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [pending, start] = useTransition();

  const index = sequence.indexOf(step);
  const total = 4;
  const displayStep =
    step === "channel"
      ? 1
      : step === "workspace"
        ? 2
        : step === "email"
          ? 3
          : 4;

  const goBack = () => {
    setError(null);
    if (index <= 0) return;
    setStep(sequence[index - 1]);
  };

  const goNext = () => {
    setError(null);
    const next = sequence[index + 1];
    if (next) setStep(next);
  };

  const selectChannel = (id: ChannelId) => {
    if (!configuredChannels.includes(id)) return;
    setChannel(id);
    setError(null);
    setStep(sequence.includes("workspace") ? "workspace" : "connect");
  };

  const submitWorkspace = () => {
    if (workspaceName.trim().length < 2) {
      setError("Enter a workspace name.");
      return;
    }
    if (phase === "workspace") {
      start(async () => {
        const res = await createWorkspace({
          channel,
          workspaceName: workspaceName.trim(),
        });
        if (res && !res.ok) setError(res.error);
      });
      return;
    }
    goNext();
  };

  const submitEmail = () => {
    if (preview) {
      goNext();
      return;
    }
    const trimmed = email.trim();
    const parsed = EmailStepSchema.safeParse({ email: trimmed });
    if (!parsed.success) {
      setError("Enter a valid work email.");
      return;
    }
    setEmail(parsed.data.email);
    setError(null);
    goNext();
  };

  const connectSlack = () => {
    if (preview) return;
    start(async () => {
      if (projectId) {
        const res = await startSlackOAuth({ projectId, origin });
        if (res && !res.ok) setError(res.error);
        return;
      }

      const trimmedWorkspace = workspaceName.trim();
      if (trimmedWorkspace.length < 2) {
        setError("Enter a workspace name (at least 2 characters).");
        if (sequence.includes("workspace")) setStep("workspace");
        return;
      }

      const trimmedEmail = email.trim();
      const emailParsed = EmailStepSchema.safeParse({ email: trimmedEmail });
      if (!emailParsed.success) {
        setError("Enter a valid work email.");
        if (sequence.includes("email")) setStep("email");
        return;
      }

      const res = await startSlackOnboardingConnect({
        channel,
        workspaceName: trimmedWorkspace,
        email: emailParsed.data.email,
        origin,
      });
      if (res && !res.ok) setError(res.error);
    });
  };

  const skip = () => {
    if (!projectId) return;
    start(async () => {
      await skipChannelConnect({ projectId });
    });
  };

  const useTeamsInstead = () => {
    setChannel("teams");
    setError(null);
  };

  const canConnect = Boolean(
    projectId ||
    (workspaceName.trim().length >= 2 &&
      EmailStepSchema.safeParse({ email: email.trim() }).success),
  );

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col px-6 py-8">
      <div className="flex flex-1 flex-col justify-center">
        <div className="space-y-8">
          <ProgressHeader
            step={displayStep}
            total={total}
            onBack={index > 0 && phase !== "connect" ? goBack : undefined}
          />

          {error ? (
            <div
              role="alert"
              className="rounded-lg bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger-fg)]"
            >
              {error}
            </div>
          ) : null}

          {step === "channel" ? (
            <ChannelStep
              selected={channel}
              configuredChannels={configuredChannels}
              onSelect={selectChannel}
            />
          ) : null}

          {step === "workspace" ? (
            <WorkspaceStep
              value={workspaceName}
              onChange={setWorkspaceName}
              pending={pending}
              onContinue={submitWorkspace}
            />
          ) : null}

          {step === "email" ? (
            <EmailStep
              email={email}
              onEmail={setEmail}
              pending={pending}
              onContinue={submitEmail}
            />
          ) : null}

          {step === "connect" ? (
            <ConnectStep
              channel={channel}
              slackOAuthReady={slackOAuthReady}
              pending={pending}
              canConnect={canConnect}
              onConnect={connectSlack}
              onSkip={skip}
              onUseTeams={useTeamsInstead}
              onUseSlack={() => setChannel("slack")}
              showSkip={Boolean(projectId)}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ChannelStep({
  selected,
  configuredChannels,
  onSelect,
}: {
  selected: ChannelId;
  configuredChannels: ChannelId[];
  onSelect: (id: ChannelId) => void;
}) {
  const configured = new Set(configuredChannels);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Heading as="h1" className="text-4xl tracking-tight">
          Where does your team talk?
        </Heading>
        <p className="text-[var(--fg-muted)]">
          Kasie joins it like a new teammate - fully native.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {CHANNELS.map((item) => {
          const enabled = configured.has(item.id);
          return (
            <ChannelTile
              key={item.id}
              selected={selected === item.id}
              disabled={!enabled}
              title={enabled ? undefined : "Not configured on this deployment"}
              onClick={() => onSelect(item.id)}
            >
              <ChannelMark id={item.id} />
              <span className="font-medium">{item.label}</span>
            </ChannelTile>
          );
        })}
      </div>
    </div>
  );
}

function WorkspaceStep({
  value,
  onChange,
  pending,
  onContinue,
}: {
  value: string;
  onChange: (value: string) => void;
  pending: boolean;
  onContinue: () => void;
}) {
  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        onContinue();
      }}
    >
      <header className="space-y-2">
        <Heading as="h1" className="text-4xl tracking-tight">
          Name your workspace
        </Heading>
        <p className="text-[var(--fg-muted)]">
          This is the team Kasie will work alongside.
        </p>
      </header>
      <div className="space-y-2">
        <Label htmlFor="workspace">Workspace name</Label>
        <Input
          id="workspace"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Acme"
          autoComplete="organization"
          required
        />
      </div>
      <Button type="submit" variant="contrast" size="lg" className="w-full" disabled={pending}>
        Continue
      </Button>
    </form>
  );
}

function EmailStep({
  email,
  onEmail,
  pending,
  onContinue,
}: {
  email: string;
  onEmail: (value: string) => void;
  pending: boolean;
  onContinue: () => void;
}) {
  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        onContinue();
      }}
    >
      <header className="space-y-2">
        <Heading as="h1" className="text-4xl tracking-tight">
          What&apos;s your work email?
        </Heading>
        <p className="text-[var(--fg-muted)]">
          Use the same email as your Slack account. Slack will verify it when you connect.
        </p>
      </header>
      <div className="space-y-2">
        <Label htmlFor="email">Work email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => onEmail(e.target.value)}
          placeholder="you@company.com"
          autoComplete="email"
          required
        />
      </div>
      <Button type="submit" variant="contrast" size="lg" className="w-full" disabled={pending}>
        Continue
      </Button>
    </form>
  );
}

function ConnectStep({
  channel,
  slackOAuthReady,
  pending,
  canConnect,
  onConnect,
  onSkip,
  onUseTeams,
  onUseSlack,
  showSkip,
}: {
  channel: ChannelId;
  slackOAuthReady: boolean;
  pending: boolean;
  canConnect: boolean;
  onConnect: () => void;
  onSkip: () => void;
  onUseTeams: () => void;
  onUseSlack: () => void;
  showSkip: boolean;
}) {
  const slackReady = channel === "slack";

  return (
    <div className="space-y-8 text-center">
      <div className="flex items-center justify-center gap-3">
        <KasieMark />
        <ArrowRightIcon size={20} className="text-[var(--fg-muted)]" />
        <span className="inline-flex size-16 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]">
          <ChannelMark id={slackReady ? "slack" : channel} className="size-9" />
        </span>
      </div>

      <header className="space-y-2">
        <Heading as="h1" className="text-4xl tracking-tight">
          Sign in and add Kasie to Slack
        </Heading>
        <p className="text-[var(--fg-muted)]">
          {slackReady
            ? "You may see two Slack prompts: sign in, then install Kasie to your workspace."
            : `${channelLabel(channel)} is not live yet. Connect Slack to start today.`}
        </p>
      </header>

      {!slackReady ? (
        <Button
          type="button"
          variant="contrast"
          size="lg"
          className="w-full"
          onClick={onUseSlack}
        >
          <ChannelMark id="slack" className="size-5" />
          Connect Slack instead
        </Button>
      ) : slackOAuthReady ? (
        <Button
          type="button"
          variant="contrast"
          size="lg"
          className="w-full"
          disabled={pending || !canConnect}
          onClick={onConnect}
        >
          <ChannelMark id="slack" className="size-5" />
          Connect Slack
        </Button>
      ) : (
        <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-5 text-left text-sm text-[var(--fg-muted)]">
          <p className="font-medium text-[var(--fg)]">Slack app not configured yet</p>
          <p>
            Create a Slack app with Sign in with Slack enabled. Set{" "}
            <code className="font-mono text-xs">SLACK_CLIENT_ID</code> and{" "}
            <code className="font-mono text-xs">SLACK_CLIENT_SECRET</code> on your deployment.
            See <strong className="text-[var(--fg)]">wiki/2-slack-app-setup.md</strong> and{" "}
            <strong className="text-[var(--fg)]">wiki/6-onboarding.md</strong>.
          </p>
        </div>
      )}

      {slackReady ? (
        <button
          type="button"
          className="text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"
          onClick={onUseTeams}
        >
          We use Microsoft Teams instead
        </button>
      ) : showSkip ? (
        <button
          type="button"
          className="text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"
          onClick={onSkip}
        >
          Continue to dashboard
        </button>
      ) : null}

      {showSkip ? (
        <button
          type="button"
          className="block w-full text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"
          onClick={onSkip}
          disabled={pending}
        >
          Skip for now
        </button>
      ) : null}

      <ul className="space-y-2 pt-4 text-sm text-[var(--fg-muted)]">
        <TrustItem>Your data stays in your database</TrustItem>
        <TrustItem>Native messages, not a sidecar bot</TrustItem>
        <TrustItem>Approvals before any write</TrustItem>
      </ul>
    </div>
  );
}

function TrustItem({ children }: { children: string }) {
  return (
    <li className="flex items-center justify-center gap-2">
      <CheckIcon size={16} weight="bold" className="text-[var(--success-fg)]" />
      {children}
    </li>
  );
}
