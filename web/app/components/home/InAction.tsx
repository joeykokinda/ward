import Image from "next/image";
import Link from "next/link";

// Real screenshots of the live /demo, captured mid-incident and at settlement,
// so the homepage shows the product working before the judge clicks through.
const SHOTS = [
  {
    src: "/shots/arc.png",
    alt: "WARD locking a USDC escrow on Arc and dispatching a verified worker, with ENS and on-chain badges firing",
    cap: "The agent hires a verified human via ENS and locks USDC escrow on Arc. Every on-chain step is badged and clickable.",
  },
  {
    src: "/shots/resolved.png",
    alt: "WARD resolved: Chainlink CRE attested the fix, escrow released to the worker, all devices healthy",
    cap: "Chainlink CRE attests the sensor reads dry and the escrow releases payment. No human approved it.",
  },
];

export function InAction() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="label">See it run</div>
        <h2 className="mt-3 max-w-3xl text-2xl font-semibold tracking-tight text-fg">
          One incident, from leak to settled, on-chain.
        </h2>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-muted">
          A 2am leak, the owner asleep. WARD detects it, fails the free remote fix,
          hires a plumber, escrows the funds, and releases payment when the sensor
          confirms dry. Roughly 27 seconds, every step verifiable.
        </p>

        <div className="mt-7 grid gap-5 md:grid-cols-2">
          {SHOTS.map((s) => (
            <figure
              key={s.src}
              className="overflow-hidden rounded-sm border border-border bg-surface"
            >
              <Image
                src={s.src}
                alt={s.alt}
                width={1440}
                height={900}
                className="h-auto w-full border-b border-border"
              />
              <figcaption className="px-4 py-3 text-[13px] leading-relaxed text-muted">
                {s.cap}
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="mt-6">
          <Link
            href="/demo"
            className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-accent-ink transition-colors hover:text-accent"
          >
            Watch the live demo →
          </Link>
        </div>
      </div>
    </section>
  );
}
