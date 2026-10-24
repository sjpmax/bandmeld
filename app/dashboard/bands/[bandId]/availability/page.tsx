// TODO: band calendar. Server Component loads band_open_dates; a
// "use client" <BandCalendar /> calls supabase.rpc("sync_band_open_dates", { p_band_id })
// (admins only) and lets admins flip status to penciled_in / booked.
export default function BandAvailabilityPage() {
  return <h1 className="text-2xl font-bold">Band availability</h1>;
}
