"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { OpsActionResult } from "@/app/ops/actions";
import {
  postOpsCalendar,
  missingRequiredField,
  type CalResult,
} from "@/lib/ops/calendar-client";
import { snapshotOpsForm } from "@/lib/forms/snapshot";

/** Tiny helper: first field error by key. */
function firstFieldError(state: OpsActionResult | null | undefined, k: string) {
  return !state?.ok ? state?.fieldErrors?.[k]?.[0] : undefined;
}

type UseOpsBookingFlowArgs = {
  /** Server Action that creates the booking (DB-first, never throws). */
  serverAction: (
    prev: OpsActionResult | null,
    formData: FormData
  ) => Promise<OpsActionResult>;
};

export function useOpsBookingFlow({ serverAction }: UseOpsBookingFlowArgs) {
  const router = useRouter();

  // Use the runtime-provided hook. Keep initial state null to match action result.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [state, formAction] = (React as any).useActionState(
    serverAction,
    null as OpsActionResult | null
  );

  // Scroll to banners after submit for clear feedback.
  const resultRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (state) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [state]);

  // Sticky values for defaultValue bindings when validation fails.
  const values = (!state?.ok ? state?.values : undefined) as
    | Record<string, string>
    | undefined;
  const machineDefault = values?.machineId ?? "";

  // Snapshot and booking id across renders.
  const lastSubmissionRef = React.useRef<Record<string, string> | null>(null);
  const lastBookingIdRef = React.useRef<string | null>(null);

  // Calendar side-effect state.
  const [calStatus, setCalStatus] = React.useState<"idle" | "pending" | "ok" | "error">(
    "idle"
  );
  const [calLink, setCalLink] = React.useState<string | undefined>(undefined);
  const [calError, setCalError] = React.useState<string | undefined>(undefined);
  const [calTraceId, setCalTraceId] = React.useState<string | undefined>(undefined);

  // Idempotency guard per booking id.
  const postedBookingIdsRef = React.useRef<Set<string>>(new Set());

  // Field error accessor.
  const fe = React.useCallback((k: string) => firstFieldError(state, k), [state]);

  // Capture snapshot before action triggers an RSC re-render.
  const onSubmitCapture = React.useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      if (calStatus === "pending") {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      lastSubmissionRef.current = snapshotOpsForm(e.currentTarget);
    },
    [calStatus]
  );

  // After booking success: post to calendar once, then refresh.
  React.useEffect(() => {
    if (!state?.ok) return;

    const bookingId = state.bookingId;
    lastBookingIdRef.current = bookingId;

    if (postedBookingIdsRef.current.has(bookingId)) return;
    postedBookingIdsRef.current.add(bookingId);

    const snap = lastSubmissionRef.current;
    if (!snap) {
      setCalStatus("error");
      setCalError("Calendar payload missing (no snapshot).");
      return;
    }

    const missing = missingRequiredField(snap);
    if (missing) {
      setCalStatus("error");
      setCalError(`Calendar payload missing field: ${missing}`);
      return;
    }

    let cancelled = false;
    setCalStatus("pending");
    setCalError(undefined);
    setCalLink(undefined);
    setCalTraceId(undefined);

    postOpsCalendar({ bookingId, ...snap })
      .then((res: CalResult) => {
        if (cancelled) return;
        if (res.ok) {
          setCalStatus("ok");
          setCalLink(res.htmlLink);
        } else {
          setCalStatus("error");
          setCalError(res.formError);
        }
        setCalTraceId(("traceId" in res && res.traceId) || undefined);
      })
      .finally(() => {
        if (!cancelled) router.refresh(); // refresh only after calendar attempt
      });

    return () => {
      cancelled = true; // avoid setState after unmount
    };
  }, [state?.ok, state?.bookingId, router]);

  // Manual retry for future Retry button.
  const retryCalendar = React.useCallback(async () => {
    const bookingId = lastBookingIdRef.current;
    const snap = lastSubmissionRef.current;
    if (!bookingId || !snap) return { ok: false as const, formError: "Nothing to retry." };

    setCalStatus("pending");
    setCalError(undefined);
    setCalLink(undefined);
    setCalTraceId(undefined);

    const res = await postOpsCalendar({ bookingId, ...snap });
    if (res.ok) {
      setCalStatus("ok");
      setCalLink(res.traceId ? res.htmlLink : res.htmlLink);
      setCalTraceId(res.traceId);
      return res;
    } else {
      setCalStatus("error");
      setCalError(res.formError);
      setCalTraceId(res.traceId);
      return res;
    }
  }, []);

  return {
    // server action bindings
    state,
    formAction,

    // UI helpers
    resultRef,
    values,
    machineDefault,
    fe,
    disableSubmit: calStatus === "pending",

    // calendar feedback
    calStatus,
    calLink,
    calError,
    calTraceId,

    // event handlers
    onSubmitCapture,
    retryCalendar,
  };
}
