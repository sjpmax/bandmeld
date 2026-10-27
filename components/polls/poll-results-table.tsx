export type ResultsCell = "yes" | "no" | "pending";

export type ResultsMember = {
  profileId: string;
  fullName: string;
  cells: Record<string, ResultsCell>; // keyed by poll_date_id
  emailStatus: "sent" | "pending" | "error";
  emailError: string | null;
};

export type ResultsDate = { id: string; targetDate: string };

const dateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

export function PollResultsTable({
  dates,
  members,
}: {
  dates: ResultsDate[];
  members: ResultsMember[];
}) {
  const tally = (dateId: string) => {
    let yes = 0;
    let no = 0;
    let pending = 0;
    for (const m of members) {
      const c = m.cells[dateId] ?? "pending";
      if (c === "yes") yes++;
      else if (c === "no") no++;
      else pending++;
    }
    return { yes, no, pending };
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border-b border-black/10 p-2 text-left dark:border-white/10">
              Member
            </th>
            {dates.map((d) => (
              <th
                key={d.id}
                className="border-b border-black/10 p-2 text-center dark:border-white/10"
              >
                <div>{dateFmt.format(new Date(`${d.targetDate}T12:00:00Z`))}</div>
                <div className="text-xs font-normal opacity-60">
                  {(() => {
                    const t = tally(d.id);
                    return `${t.yes}✓ / ${t.no}✗ / ${t.pending}·`;
                  })()}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.profileId}>
              <td className="border-b border-black/5 p-2 dark:border-white/5">
                <div className="font-medium">{m.fullName}</div>
                <div className="text-xs opacity-60">
                  {m.emailStatus === "sent" && "emailed"}
                  {m.emailStatus === "pending" && "sending…"}
                  {m.emailStatus === "error" && (
                    <span className="text-red-500">email failed: {m.emailError}</span>
                  )}
                </div>
              </td>
              {dates.map((d) => {
                const c = m.cells[d.id] ?? "pending";
                return (
                  <td
                    key={d.id}
                    className="border-b border-black/5 p-2 text-center dark:border-white/5"
                  >
                    {c === "yes" && "✓"}
                    {c === "no" && "✗"}
                    {c === "pending" && <span className="opacity-40">·</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
