const STEPS: { n: string; title: string; body: string }[] = [
  { n: "01", title: "Detect", body: "A sensor trips." },
  {
    n: "02",
    title: "Diagnose",
    body: "The agent reasons about the fault and tries the free remote fix.",
  },
  {
    n: "03",
    title: "Hire",
    body: "If it cannot fix it remotely, it locks USDC escrow and dispatches a verified human.",
  },
  {
    n: "04",
    title: "Verify",
    body: "A Chainlink oracle reads the device and releases payment.",
  },
];

export function HowItWorks() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-2xl font-semibold tracking-tight text-fg">How it works</h2>
        <div className="mt-8 grid gap-px overflow-hidden rounded-sm border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <div key={step.n} className="bg-surface p-6">
              <span className="mono text-[13px] text-accent-ink">{step.n}</span>
              <h3 className="mt-3 text-[15px] font-semibold text-fg-soft">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-[15px] font-medium text-fg-soft">
          All on-chain. The sensor approves the payment, not a human.
        </p>
      </div>
    </section>
  );
}
