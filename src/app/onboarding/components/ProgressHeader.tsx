import { ArrowLeftIcon } from "@phosphor-icons/react";
import { Button } from "@/design-system";

type ProgressHeaderProps = {
  step: number;
  total: number;
  onBack?: () => void;
};

export function ProgressHeader({ step, total, onBack }: ProgressHeaderProps) {
  const percent = Math.max(8, Math.round((step / total) * 100));

  return (
    <div className="flex items-center gap-3">
      {onBack ? (
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label="Back"
          onClick={onBack}
        >
          <ArrowLeftIcon size={18} />
        </Button>
      ) : (
        <span className="size-10" />
      )}
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--border-subtle)]"
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={`Step ${step} of ${total}`}
      >
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-sm text-[var(--fg-muted)]">
        {step} / {total}
      </span>
    </div>
  );
}
