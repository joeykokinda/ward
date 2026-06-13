// The sovereign-identity story: ENS as the federated identity layer for both
// sides of the economy. Workers own their reputation, agents own their
// identity, WARD is the protocol between them — not a platform they're locked
// into. This is the ENS-track narrative in product form.

function Cell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface p-6">
      <div className="text-[13px] font-semibold text-fg">{title}</div>
      <p className="mt-2.5 text-[14px] leading-relaxed text-muted">{children}</p>
    </div>
  );
}

export function Identity() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="label">Identity · ENS</div>
        <h2 className="mt-3 max-w-3xl text-2xl font-semibold tracking-tight text-fg">
          Every party is sovereign. WARD is the protocol, not the platform.
        </h2>

        <div className="mt-7 grid gap-px overflow-hidden rounded-sm border border-border bg-border md:grid-cols-3">
          <Cell title="Workers own their reputation">
            A pro registers once. Their skills, region, and job history live as
            ENSIP-26 records on a name they own, not in our database. The design
            lets them carry that reputation to any agent network.
          </Cell>
          <Cell title="Agents own their identity">
            Each home or fleet runs its own agent with its own name, wallet, and
            on-chain history. The demo agent,{" "}
            <span className="mono text-fg-soft">ward-agent.eth</span>, is verified
            per ENSIP-25. In production it&apos;s{" "}
            <span className="mono text-fg-soft">agent.alice.eth</span>,{" "}
            <span className="mono text-fg-soft">agent.helium-fleet-7.eth</span>. No
            shared backend wallet.
          </Cell>
          <Cell title="No lock-in">
            If WARD shut down tomorrow, the worker still owns their name and their
            job history is still on-chain. Another network can read it and hire
            them directly &mdash; no re-signup, no reputation to rebuild.
          </Cell>
        </div>

        <p className="mt-7 max-w-3xl text-[15px] leading-relaxed text-fg-soft">
          ENS is the federated identity layer that lets independent agents
          discover and rank independent workers with no platform in the middle.
          You&apos;d never invest in a profile a marketplace owns. You will invest
          in a name you own forever.
        </p>
      </div>
    </section>
  );
}
