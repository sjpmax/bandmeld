"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { addUnavailability } from "@/app/dashboard/availability/actions";
import type { ActionResult } from "@/types";

const initial: ActionResult = { ok: true };

function todayIsoLocal() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function UnavailabilityForm() {
  const [state, formAction, pending] = useActionState(addUnavailability, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.ok) {
      toast.error(state.error);
    } else if (state.message) {
      toast.success(state.message);
      formRef.current?.reset();
    }
  }, [state]);

  const today = todayIsoLocal();
  const input =
    "w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 text-base text-ink dark:border-white/20 dark:bg-white/5 dark:text-inherit";

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-black/10 p-4 dark:border-white/10"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Start
          <input name="start_date" type="date" required min={today} className={input} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          End
          <input name="end_date" type="date" required min={today} className={input} />
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Reason (private)
        <input
          name="reason"
          type="text"
          maxLength={120}
          placeholder="On tour, work travel, out of town…"
          className={input}
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">How firm?</legend>
        <div className="flex flex-wrap gap-2">
          <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-black/15 px-3 py-2 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent/10 dark:border-white/20">
            <input type="radio" name="firmness" value="firm" defaultChecked />
            <span>
              <span className="font-medium">Firm</span>
              <span className="block opacity-70">Band can&apos;t book me</span>
            </span>
          </label>
          <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-black/15 px-3 py-2 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent/10 dark:border-white/20">
            <input type="radio" name="firmness" value="tentative" />
            <span>
              <span className="font-medium">Maybe</span>
              <span className="block opacity-70">I&apos;d cancel for a show</span>
            </span>
          </label>
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-accent px-5 py-2 font-medium text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : "Block these dates"}
      </button>
      <p className="text-xs opacity-60">
        Your reason stays private — bandmates only see the dates. Band admins resync the band
        calendar from the band page.
      </p>
    </form>
  );
}
