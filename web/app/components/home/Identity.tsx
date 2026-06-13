// The sovereign-identity story: ENS as the federated identity layer for both
// sides of the economy. Workers own their reputation, agents own their
// identity, WARD is the protocol between them, not a platform they're locked
// into. This is the ENS-track narrative in product form.

function Cell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface p-6 transition-colors hover:bg-subtle">
      <div className="text-[13px] font-semibold text-fg">{title}</div>
      <p className="mt-2.5 text-[14px] leading-relaxed text-muted">{children}</p>
    </div>
  );
}

export function Identity() {
  return (
    <section
      id="identity"
      className="section-light flex min-h-svh scroll-mt-16 items-center border-b border-border"
    >
      <div className="reveal mx-auto w-full max-w-5xl px-6 py-24 md:py-28">
        <div className="label">Identity · ENS</div>
        <h2 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight text-fg md:text-5xl">
          Everyone owns their identity. WARD is the protocol, not the platform.
        </h2>

        <div className="reveal-stagger mt-7 grid gap-px overflow-hidden rounded-sm border border-border bg-border md:grid-cols-3">
          <Cell title="Workers own their reputation">
            A pro&apos;s reputation lives on an ENS name they own, not in our
            database &mdash; portable to any network, earned not bought.
          </Cell>
          <Cell title="Agents own their identity">
            Every home runs its own agent. We registered a real one,{" "}
            <span className="mono text-fg-soft">agent.demo-home.eth</span>, beside
            the protocol&apos;s own{" "}
            <span className="mono text-fg-soft">ward-agent.eth</span>.
          </Cell>
          <Cell title="No lock-in">
            If WARD vanished tomorrow, the worker keeps their name and history. Any
            network can read it and hire them.
          </Cell>
        </div>

        <p className="mt-7 max-w-3xl text-[15px] leading-relaxed text-fg-soft">
          ENS is the shared address book for this whole economy: any agent can look
          up and rank any worker, no company in the middle. A name that&apos;s yours
          forever, never a profile a marketplace owns.
        </p>
      </div>
    </section>
  );
}
