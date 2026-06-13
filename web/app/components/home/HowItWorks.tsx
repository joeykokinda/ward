const STEPS: { n: string; title: string; body: string }[] = [
  { n: "01", title: "Detect", body: "A sensor trips. The agent wakes up." },
  {
    n: "02",
    title: "Diagnose",
    body: "It works out what's wrong and tries the cheapest fix first — in software, for free.",
  },
  {
    n: "03",
    title: "Hire",
    body: "Only when software can't touch it: it locks USDC in escrow and sends a verified human.",
  },
  {
    n: "04",
    title: "Verify",
    body: "Chainlink CRE settles the verdict from the device's telemetry. Code releases the payment, not a person.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how"
      className="flex min-h-svh scroll-mt-16 items-center border-b border-border bg-bg"
    >
      <div className="reveal mx-auto w-full max-w-5xl px-6 py-24 md:py-28">
        <div className="label">The loop</div>
        <h2 className="mt-3 max-w-2xl text-4xl font-bold tracking-tight text-fg md:text-5xl">
          Cheapest fix first. A human only when it&apos;s physical.
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
          Detect · Diagnose · Hire · Verify. Most faults self-fix in software for
          free; a human is hired only when software can&apos;t touch it. The owner
          is never paged.
        </p>
        <div className="reveal-stagger mt-10 grid gap-px overflow-hidden rounded-sm border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <div
              key={step.n}
              className="bg-surface p-7 transition-colors hover:bg-subtle"
            >
              <span className="mono text-[13px] text-accent-ink">{step.n}</span>
              <h3 className="mt-3 text-base font-semibold text-fg-soft">
                {step.title}
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{step.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 text-base font-medium text-fg-soft">
          Code releases the payment, not a person &mdash; and only after the fix
          holds.
        </p>
      </div>
    </section>
  );
}
