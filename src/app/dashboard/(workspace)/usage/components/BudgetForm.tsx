"use client";

import { useTransition } from "react";
import { Button, Input, Label } from "@/design-system";
import { updateOrgBudget } from "../actions";

type BudgetFormProps = {
  monthlyBudgetCents: number | null;
};

export function BudgetForm({ monthlyBudgetCents }: BudgetFormProps) {
  const [pending, start] = useTransition();
  const defaultUsd =
    monthlyBudgetCents != null ? (monthlyBudgetCents / 100).toString() : "";

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      action={(fd) => {
        start(async () => {
          const intent = String(fd.get("intent"));
          if (intent === "clear") {
            await updateOrgBudget({ intent: "clear" });
            return;
          }
          await updateOrgBudget({
            intent: "set",
            usd: fd.get("usd"),
          });
        });
      }}
    >
      <div className="min-w-40 flex-1">
        <Label htmlFor="budget-usd">Monthly spend cap (USD)</Label>
        <Input
          id="budget-usd"
          name="usd"
          type="number"
          min="0"
          step="0.01"
          defaultValue={defaultUsd}
          placeholder="Unlimited"
          className="mt-1"
        />
      </div>
      <Button type="submit" name="intent" value="set" disabled={pending}>
        {pending ? "Saving..." : "Save cap"}
      </Button>
      {monthlyBudgetCents != null ? (
        <Button
          type="submit"
          name="intent"
          value="clear"
          variant="ghost"
          disabled={pending}
        >
          Clear (unlimited)
        </Button>
      ) : null}
    </form>
  );
}
