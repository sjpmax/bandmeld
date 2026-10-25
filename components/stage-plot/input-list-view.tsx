import type { InputListRow } from "@/types/stage-plot";

type Props = { rows: InputListRow[] };

/**
 * Read-only input list table for the public EPK and the print route.
 * Rows are rendered in channel-ascending order regardless of input order.
 */
export function InputListView({ rows }: Props) {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => a.channel - b.channel);

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-black/15 text-left text-xs uppercase tracking-wide opacity-60 dark:border-white/15">
          <th className="w-10 py-1.5 pr-2">Ch</th>
          <th className="py-1.5 pr-2">Source</th>
          <th className="py-1.5 pr-2">Mic / DI</th>
          <th className="w-16 py-1.5 pr-2">+48V</th>
          <th className="py-1.5">Notes</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((row) => (
          <tr key={row.id} className="border-b border-black/5 dark:border-white/5">
            <td className="py-1.5 pr-2 font-mono tabular-nums">{row.channel}</td>
            <td className="py-1.5 pr-2">{row.source}</td>
            <td className="py-1.5 pr-2">{row.mic}</td>
            <td className="py-1.5 pr-2">{row.phantom ? "Yes" : "—"}</td>
            <td className="py-1.5 opacity-70">{row.notes ?? ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
