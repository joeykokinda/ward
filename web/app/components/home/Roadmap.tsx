export function Roadmap() {
  return (
    <section
      id="roadmap"
      className="section-light flex min-h-svh scroll-mt-16 items-center border-b border-border"
    >
      <div className="reveal mx-auto w-full max-w-5xl px-6 py-24 md:py-28">
        <div className="label">Where this goes</div>
        <h2 className="mt-3 max-w-4xl text-4xl font-bold tracking-tight text-fg md:text-5xl">
          One home today. Every autonomous system tomorrow.
        </h2>

        <div className="reveal-stagger mt-10 grid gap-px overflow-hidden rounded-sm border border-border bg-border md:grid-cols-2">
          <div className="bg-surface p-7">
            <div className="label text-accent-ink">Today</div>
            <p className="mt-3 text-[15px] leading-relaxed text-fg-soft">
              A single instrumented home: the agent fixing what it can and hiring a
              local pro when it can&apos;t.
            </p>
          </div>
          <div className="bg-surface p-7">
            <div className="label text-accent-ink">Tomorrow</div>
            <p className="mt-3 text-[15px] leading-relaxed text-fg-soft">
              Property managers, DePIN fleets, DAO treasuries &mdash; same ERC-8183
              contracts, same CRE attestation, same ENS registry, no rewrite.
            </p>
          </div>
        </div>

        <p className="mt-8 max-w-3xl text-base leading-relaxed text-fg-soft">
          Every home gets its own agent; every worker owns their identity.
        </p>
      </div>
    </section>
  );
}
