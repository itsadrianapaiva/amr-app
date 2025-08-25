import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * AddOnRow
 * Pure presentational row used in the AddOnsPanel.
 * - No formatting or pricing logic.
 * - Container owns the state; this just renders and forwards changes.
 */
type AddOnRowProps = {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onToggle: (v: boolean) => void;
  /** Optional badge text, e.g., "Recommended" */
  badge?: string;
};

function AddOnRow({
  id,
  title,
  description,
  checked,
  onToggle,
  badge,
}: AddOnRowProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div>
        <p className="font-medium">
          {title}
          {badge ? (
            <span className="ml-2 rounded bg-primary/10 px-2 py-0.5 text-xs">
              {badge}
            </span>
          ) : null}
        </p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onToggle(Boolean(v))}
      />
    </div>
  );
}

export default React.memo(AddOnRow);
