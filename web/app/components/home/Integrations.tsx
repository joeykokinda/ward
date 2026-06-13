const INTEGRATIONS: { name: string; body: string }[] = [
  {
    name: "Chainlink CRE",
    body: "Fetches device telemetry from a public endpoint, attests the fix on-chain, and triggers settlement.",
  },
  {
    name: "Arc",
    body: "Gas-free USDC with sub-cent fees. Holds the conditional escrow and releases it automatically on attestation.",
  },
  {
    name: "ENS",
    body: "Agents have names, workers have portable on-chain reputation. The agent discovers workers by resolving ENS.",
  },
];

export function Integrations() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-2xl font-semibold tracking-tight text-fg">Integrations</h2>
        <div className="mt-8 grid gap-px overflow-hidden rounded-sm border border-border bg-border sm:grid-cols-3">
          {INTEGRATIONS.map((integration) => (
            <div key={integration.name} className="bg-surface p-6">
              <h3 className="text-[15px] font-semibold text-fg">{integration.name}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {integration.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
