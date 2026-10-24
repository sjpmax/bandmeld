export default function Loading() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold sm:text-3xl">Review Google Calendar events</h1>
      <p className="opacity-70">Pulling your calendar…</p>
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-xl bg-black/5 dark:bg-white/5"
          />
        ))}
      </div>
    </div>
  );
}
