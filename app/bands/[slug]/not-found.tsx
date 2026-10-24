import Link from "next/link";

export default function BandNotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-2xl font-semibold">We couldn&apos;t find that band</h1>
      <p className="opacity-70">The link may be mistyped, or the band changed its URL.</p>
      <Link href="/" className="underline">Go to BandSnap</Link>
    </main>
  );
}
