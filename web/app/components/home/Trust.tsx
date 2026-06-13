const POINTS: { name: string; body: string }[] = [
  {
    name: "Bonded",
    body: "Workers stake USDC to take a job, more than a single job pays. Fake the fix and the bond is what's on the line.",
  },
  {
    name: "Windowed",
    body: "Escrow holds through a warranty period. A fix that fails in 48 hours claws the money back and slashes the bond.",
  },
  {
    name: "Earned, not bought",
    body: "Reputation is bound to a verified human, built from real jobs. It can't be transferred or sold, so a clean name can't be farmed.",
  },
  {
    name: "Sampled",
    body: "Jobs are randomly audited. Get caught faking and the bond slashes — and the auditor is staked too.",
  },
];

export function Trust() {
  return (
    <section
      id="trust"
      className="section-light flex min-h-svh scroll-mt-16 items-center border-b border-border"
    >
      <div className="reveal mx-auto w-full max-w-5xl px-6 py-24 md:py-28">
        <div className="label">Trust</div>
        <h2 className="mt-3 max-w-2xl text-4xl font-bold tracking-tight text-fg md:text-5xl">
          Keep it honest.
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
          The hard part isn&apos;t paying a stranger on-chain, it&apos;s knowing
          the work was real. WARD assumes the worker might lie and prices it in.
        </p>

        <div className="reveal-stagger mt-10 grid gap-px overflow-hidden rounded-sm border border-border bg-border sm:grid-cols-2">
          {POINTS.map((p) => (
            <div
              key={p.name}
              className="bg-surface p-7 transition-colors hover:bg-subtle"
            >
              <h3 className="text-base font-semibold text-fg">{p.name}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-muted">{p.body}</p>
            </div>
          ))}
        </div>

        <p className="mt-6 max-w-3xl text-[13px] leading-relaxed text-faint">
          Live on Arc today: staking and on-chain reputation.
        </p>
        <p className="mt-5 max-w-3xl text-base font-medium leading-relaxed text-fg-soft">
          We don&apos;t claim it&apos;s unfakeable; we claim faking it costs more
          than doing the job.
        </p>
      </div>
    </section>
  );
}
