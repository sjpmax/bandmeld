import type { Metadata } from "next";

export const metadata: Metadata = { title: "My availability" };

// TODO: "use client" <UnavailabilityPicker /> writing member_unavailabilities
// for the current user (RLS: profile_id must equal auth.uid()).
export default function MyAvailabilityPage() {
  return <h1 className="text-2xl font-bold">My availability</h1>;
}
