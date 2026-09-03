"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { XIcon } from "@phosphor-icons/react";
import { Button, Modal, RadioCardGroup } from "@/design-system";
import {
  buildConnectIframeUrl,
  isPipedreamConnectMessage,
} from "@/lib/pipedream/connect-iframe";
import { completeIntegrationAction } from "../actions";

type ConnectIntegrationModalProps = {
  open: boolean;
  onClose: () => void;
  appSlug: string;
  appLabel: string;
  pipedreamEnabled: boolean;
  onSuccess?: () => void;
};

type Phase = "configure" | "connecting";

export function ConnectIntegrationModal({
  open,
  onClose,
  appSlug,
  appLabel,
  pipedreamEnabled,
  onSuccess,
}: ConnectIntegrationModalProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("configure");
  const [visibility, setVisibility] = useState<"workspace" | "private">("workspace");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [connectUrl, setConnectUrl] = useState<string | null>(null);
  const integrationIdRef = useRef<string | null>(null);
  const finishingRef = useRef(false);

  const finishConnect = useCallback(
    async (accountId: string) => {
      if (finishingRef.current) return;
      finishingRef.current = true;

      const integrationId = integrationIdRef.current;
      if (!integrationId) {
        finishingRef.current = false;
        setError("Missing integration record");
        setPhase("configure");
        setConnectUrl(null);
        return;
      }

      const result = await completeIntegrationAction({ integrationId, accountId });
      if (!result.ok) {
        finishingRef.current = false;
        setError(result.error);
        setPhase("configure");
        setConnectUrl(null);
        return;
      }

      onClose();
      onSuccess?.();
      router.refresh();
    },
    [onClose, onSuccess, router],
  );

  useEffect(() => {
    if (phase !== "connecting" || !connectUrl) return;

    let connectionSuccessful = false;

    const onMessage = (event: MessageEvent) => {
      if (!isPipedreamConnectMessage(event.data)) return;

      switch (event.data.type) {
        case "success":
          connectionSuccessful = true;
          void finishConnect(event.data.authProvisionId);
          break;
        case "error":
          setError(event.data.error ?? "Connection failed");
          setPhase("configure");
          setConnectUrl(null);
          break;
        case "close":
          if (!connectionSuccessful) {
            setPhase("configure");
            setConnectUrl(null);
          }
          break;
      }
    };

    window.addEventListener("message", onMessage);
    // The configure modal is closed during connect, so lock scroll ourselves.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("message", onMessage);
      document.body.style.overflow = previous;
    };
  }, [phase, connectUrl, finishConnect]);

  const connect = useCallback(() => {
    if (!pipedreamEnabled) return;
    setError(null);
    start(async () => {
      try {
        const bootstrap = await fetch("/api/pipedream/connect-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appSlug, visibility }),
        });
        if (!bootstrap.ok) {
          const body = (await bootstrap.json()) as { error?: string };
          throw new Error(body.error ?? "Failed to start connect flow");
        }
        const data = (await bootstrap.json()) as {
          token: string;
          integrationId: string;
        };
        integrationIdRef.current = data.integrationId;
        setConnectUrl(buildConnectIframeUrl({ token: data.token, appSlug }));
        setPhase("connecting");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Connection failed");
      }
    });
  }, [pipedreamEnabled, appSlug, visibility]);

  const handleClose = useCallback(() => {
    finishingRef.current = false;
    setPhase("configure");
    setConnectUrl(null);
    onClose();
  }, [onClose]);

  // The dialog also closes when the connect iframe takes over; only treat it
  // as a user dismissal while still on the configure step.
  const handleModalClose = useCallback(() => {
    if (phase === "connecting") return;
    handleClose();
  }, [phase, handleClose]);

  return (
    <>
      {phase === "connecting" && connectUrl ? (
        <iframe
          src={connectUrl}
          title={`Connect ${appLabel}`}
          // color-scheme must match the embedded (light) page: on a mismatch,
          // Chromium paints an opaque canvas behind cross-origin iframes and
          // the overlay loses its transparency.
          className="fixed inset-0 z-50 h-full w-full border-0 bg-transparent [color-scheme:light]"
        />
      ) : null}

      <Modal open={open && phase === "configure"} onClose={handleModalClose}>
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Connect a {appLabel} account</h2>
              <p className="mt-1 text-sm text-[var(--fg-muted)]">
                Kasie uses Pipedream to connect securely. You can name this account after connecting.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="-mr-1.5 -mt-1.5 grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-elevated)] hover:text-[var(--fg)] active:bg-[var(--surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              aria-label="Close"
            >
              <XIcon size={18} />
            </button>
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium">Who can use it?</p>
              <RadioCardGroup
                name="visibility"
                value={visibility}
                onChange={setVisibility}
                options={[
                  {
                    value: "workspace",
                    label: "Everyone in the workspace",
                    description: "Anyone can use it through Kasie anywhere.",
                    badge: "Recommended",
                  },
                  {
                    value: "private",
                    label: "Private",
                    description:
                      "Only you can use this account. You can invite others later in settings.",
                  },
                ]}
              />
            </div>

            {error ? <p className="text-sm text-red-500">{error}</p> : null}
            {!pipedreamEnabled ? (
              <p className="text-sm text-[var(--fg-muted)]">
                Pipedream is not configured. Set PIPEDREAM_CLIENT_ID, PIPEDREAM_CLIENT_SECRET, and
                PIPEDREAM_PROJECT_ID.
              </p>
            ) : null}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <Button variant="ghost" onClick={handleClose} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={connect} disabled={pending || !pipedreamEnabled}>
              {pending ? "Connecting…" : `Continue to ${appLabel}`}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
