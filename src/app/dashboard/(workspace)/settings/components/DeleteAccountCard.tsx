"use client";

import { useState, useTransition } from "react";
import { Button, FormFeedback, SettingsSectionCard } from "@/design-system";
import { deleteAccountAction } from "../actions";

export function DeleteAccountCard() {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [feedback, setFeedback] = useState<{ error?: string }>({});

  function handleDelete() {
    setFeedback({});
    start(async () => {
      const result = await deleteAccountAction();
      if (!result.ok) {
        setFeedback({ error: result.error });
        setConfirming(false);
      }
    });
  }

  return (
    <SettingsSectionCard
      variant="destructive"
      title="Delete account"
      description="Permanently remove your account and sign out. This action is not reversible."
    >
      <FormFeedback error={feedback.error} className="mb-4" />

      {confirming ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="danger" disabled={pending} onClick={handleDelete}>
            {pending ? "Deleting..." : "Yes, delete my account"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => setConfirming(false)}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button type="button" variant="danger" onClick={() => setConfirming(true)}>
          Delete account
        </Button>
      )}
    </SettingsSectionCard>
  );
}
