import type { Metadata } from "next";
import Link from "next/link";
import { CreateBandForm } from "@/components/bands/create-band-form";

export const metadata: Metadata = { title: "New band" };

export default function NewBandPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold sm:text-3xl">Create a band</h1>
        <p className="mt-1 opacity-70">
          A band is a shared space for your lineup — calendar, EPK assets, and bill-booking later
          on.
        </p>
      </header>
      <CreateBandForm />
      <p className="text-sm opacity-70">
        <Link href="/dashboard" className="underline">
          ← Back to dashboard
        </Link>
      </p>
    </div>
  );
}
