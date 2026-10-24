"use client";

import { useEffect } from "react";

/** Catches thrown errors (e.g. Supabase network failures) in any route segment. */
export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main role="alert" className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="opacity-70">We couldn&apos;t load this page. Check your connection and try again.</p>
      <button onClick={reset} className="rounded-full bg-accent px-5 py-2.5 font-medium text-white">
        Try again
      </button>
    </main>
  );
}
