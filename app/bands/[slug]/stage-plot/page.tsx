import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicEpk } from "@/lib/epk";
import { parseStagePlot } from "@/types/stage-plot";
import { StagePlotRenderer } from "@/components/stage-plot/renderer";
import { InputListView } from "@/components/stage-plot/input-list-view";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const band = await getPublicEpk(slug);
  return { title: band ? `${band.name} — Stage plot` : "Band not found" };
}

export default async function StagePlotPrintPage({ params }: Props) {
  const { slug } = await params;
  const band = await getPublicEpk(slug);
  if (!band) notFound();

  const plot = parseStagePlot(band.stage_plot);
  if (plot.items.length === 0) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">{band.name}</h1>
        <p className="opacity-60">No stage plot available.</p>
      </main>
    );
  }

  return (
    <main className="print-root mx-auto flex max-w-[8.5in] flex-col gap-6 px-6 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">{band.name}</h1>
        <p className="text-sm opacity-70">Stage plot — {band.home_city}</p>
      </header>

      <StagePlotRenderer plot={plot} />

      {plot.input_list.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide opacity-70">Input list</h2>
          <InputListView rows={plot.input_list} />
        </section>
      )}

      <style>{`
        @media print {
          @page { size: letter portrait; margin: 0.5in; }
          body { background: white !important; }
          .print-root { max-width: 100% !important; padding: 0 !important; }
          header + div { page-break-inside: avoid; }
        }
      `}</style>
    </main>
  );
}
