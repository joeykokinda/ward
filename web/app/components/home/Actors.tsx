const ACTORS: { label: string; name?: string; body: React.ReactNode }[] = [
  {
    label: "Agent",
    body: (
      <>
        <span className="mono text-fg-soft">ward-agent.eth</span> &mdash; this
        home&apos;s own agent. It decides and pays.
      </>
    ),
  },
  {
    label: "Human",
    body: (
      <>
        A verified local pro. They own their ENS name and the on-chain reputation
        attached to it.
      </>
    ),
  },
  {
    label: "Arc chain",
    body: <>Holds the USDC in escrow and pays it out automatically.</>,
  },
];

export function Actors() {
  return (
    <section
      id="actors"
      className="section-light flex min-h-svh scroll-mt-16 items-center border-b border-border"
    >
      <div className="reveal mx-auto w-full max-w-5xl px-6 py-24 md:py-28">
        <div className="label">The cast</div>
        <h2 className="mt-3 max-w-2xl text-4xl font-bold tracking-tight text-fg md:text-5xl">
          Three parties, one protocol.
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
          No company in the middle. The agent decides and pays, the human does the
          work, the chain settles &mdash; each a named identity anyone can verify.
        </p>
        <div className="reveal-stagger mt-10 grid gap-px overflow-hidden rounded-sm border border-border bg-border sm:grid-cols-3">
          {ACTORS.map((actor) => (
            <div
              key={actor.label}
              className="bg-surface p-7 transition-colors hover:bg-subtle"
            >
              <div className="label">{actor.label}</div>
              <p className="mt-3 text-base leading-relaxed text-fg-soft">
                {actor.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
