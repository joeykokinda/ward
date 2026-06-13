const INTEGRATIONS: { name: string; body: string }[] = [
  {
    name: "Chainlink CRE",
    body: "Reads the device telemetry and settles the verdict on-chain.",
  },
  {
    name: "Arc",
    body: "Holds the USDC escrow and pays out automatically, gas-free and sub-cent.",
  },
  {
    name: "ENS",
    body: "Gives agents and workers real names with reputation, so the agent finds the right human by lookup.",
  },
];

export function Integrations() {
  return (
    <section
      id="integrations"
      className="flex min-h-svh scroll-mt-16 items-center border-b border-border bg-bg"
    >
      <div className="reveal mx-auto w-full max-w-5xl px-6 py-24 md:py-28">
        <div className="label">The stack</div>
        <h2 className="mt-3 max-w-2xl text-4xl font-bold tracking-tight text-fg md:text-5xl">
          Three sponsors, one job each.
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
          No glue code for show. Each one carries real weight in the flow.
        </p>
        <div className="reveal-stagger mt-10 grid gap-px overflow-hidden rounded-sm border border-border bg-border sm:grid-cols-3">
          {INTEGRATIONS.map((integration) => (
            <div
              key={integration.name}
              className="bg-surface p-7 transition-colors hover:bg-subtle"
            >
              <h3 className="text-base font-semibold text-fg">{integration.name}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-muted">
                {integration.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
