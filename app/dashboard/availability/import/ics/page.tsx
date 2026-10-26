import type { Metadata } from "next";
import Link from "next/link";
import { requireUserId } from "@/utils/supabase/server";
import { IcsUploader } from "@/components/availability/ics-uploader";

export const metadata: Metadata = { title: "Import .ics file" };

export default async function IcsImportPage() {
  await requireUserId("/dashboard/availability/import/ics");

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold sm:text-3xl">Import an .ics file</h1>
        <p className="opacity-70">
          Apple Calendar, Outlook, Fantastical — any app that exports .ics works.
          Upload the file and pick which events become unavailability blocks.
        </p>
        <p className="text-xs opacity-60">
          Nothing from the file leaves your browser until you confirm — parsing happens
          locally.
        </p>
        <p className="text-sm">
          <Link href="/dashboard/availability" className="underline opacity-70 hover:opacity-100">
            ← Back to availability
          </Link>
        </p>
      </header>

      <IcsUploader />
    </div>
  );
}
