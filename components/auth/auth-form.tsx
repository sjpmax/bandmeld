"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { signIn, signUp } from "@/app/(auth)/actions";
import type { ActionResult } from "@/types";

const initial: ActionResult = { ok: true };

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const [state, formAction, pending] = useActionState(mode === "login" ? signIn : signUp, initial);

  useEffect(() => {
    if (!state.ok) toast.error(state.error);
    else if (state.message) toast.success(state.message);
  }, [state]);

  const input =
    "w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 text-base text-ink dark:border-white/20 dark:bg-white/5 dark:text-inherit";

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      {next && <input type="hidden" name="next" value={next} />}

      {mode === "signup" && (
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Your name
          <input name="full_name" autoComplete="name" required className={input} />
        </label>
      )}
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Email
        <input name="email" type="email" autoComplete="email" required className={input} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Password
        <input
          name="password"
          type="password"
          minLength={mode === "signup" ? 8 : undefined}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          required
          className={input}
        />
      </label>

      {!state.ok && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-accent px-5 py-2.5 font-medium text-white disabled:opacity-60"
      >
        {pending ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
      </button>

      <p className="text-center text-sm opacity-80">
        {mode === "login" ? (
          <>
            No account?{" "}
            <Link
              href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}
              className="underline"
            >
              Sign up
            </Link>
          </>
        ) : (
          <>
            Already have one?{" "}
            <Link
              href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
              className="underline"
            >
              Log in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
