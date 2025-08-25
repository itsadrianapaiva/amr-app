"use client";

import * as React from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";

export type MissingAddOns = {
  insurance?: boolean;
  delivery?: boolean;
  pickup?: boolean;
  operator?: boolean;
};

type AddOnOptOutDialogProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Flags for which add-ons are currently OFF */
  missing: MissingAddOns;
  /** Called after the user confirms they understand the risks */
  onConfirm: () => void;
};

function AddOnOptOutDialog({
  open,
  onOpenChange,
  missing,
  onConfirm,
}: AddOnOptOutDialogProps) {
  const [ack, setAck] = React.useState(false);

  // Reset the acknowledgement each time the dialog is opened
  React.useEffect(() => {
    if (open) setAck(false);
  }, [open]);

  const items: string[] = [];
  if (missing.insurance) {
    items.push(
      "Without Insurance, you are responsible for any damage during the rental."
    );
  }
  if (missing.delivery) {
    items.push(
      "Without Delivery, you must arrange legal and insured transport for the machine."
    );
  }
  if (missing.pickup) {
    items.push(
      "Without Pickup, you must return the machine by the agreed time and location."
    );
  }
  if (missing.operator) {
    items.push(
      "Without a Driver/Operator, you must provide a certified operator. Misuse may lead to extra charges."
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Before you continue</AlertDialogTitle>
          <AlertDialogDescription>
            You are proceeding without some recommended add-ons. Please read and
            confirm you understand the responsibilities:
          </AlertDialogDescription>
        </AlertDialogHeader>

        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {items.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>

        <label className="mt-4 flex items-center gap-2 text-sm">
          <Checkbox checked={ack} onCheckedChange={(v) => setAck(Boolean(v))} />
          <span>I understand and accept these responsibilities.</span>
        </label>

        <AlertDialogFooter>
          <AlertDialogCancel>Go back</AlertDialogCancel>
          <AlertDialogAction
            disabled={!ack}
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
          >
            Continue
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default React.memo(AddOnOptOutDialog);
