const ACTORS: { label: string; name?: string; body: React.ReactNode }[] = [
  {
    label: "Agent",
    body: (
      <>
        <span className="mono text-fg-soft">ward-agent.eth</span> decides and pays.
      </>
    ),
  },
  {
    label: "Human",
    body: <>A verified pro, found and ranked through ENS.</>,
  },
  {
    label: "Arc chain",
    body: <>Where the USDC escrow lives and settles.</>,
  },
];

export function Actors() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid gap-px overflow-hidden rounded-sm border border-border bg-border sm:grid-cols-3">
          {ACTORS.map((actor) => (
            <div key={actor.label} className="bg-surface p-6">
              <div className="label">{actor.label}</div>
              <p className="mt-3 text-[15px] leading-relaxed text-fg-soft">
                {actor.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
