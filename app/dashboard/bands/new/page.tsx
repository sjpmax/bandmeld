import type { Metadata } from "next";

export const metadata: Metadata = { title: "New band" };

// TODO(next task): <CreateBandForm /> client component → server action calling
// supabase.rpc("create_band", {...}) → returns the new band id; redirect to
// /dashboard/bands/[id]. Map error code 23505 to "That URL is taken".
export default function NewBandPage() {
  return <h1 className="text-2xl font-bold">Create a band</h1>;
}
