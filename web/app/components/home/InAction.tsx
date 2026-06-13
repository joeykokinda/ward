import Image from "next/image";
import Link from "next/link";

// Real screenshots of the live /demo, captured mid-incident and at settlement,
// so the homepage shows the product working before the judge clicks through.
const SHOTS = [
  {
    src: "/shots/arc.png",
    alt: "WARD locking a USDC escrow on Arc and dispatching a verified worker, with ENS and on-chain badges firing",
    cap: "The agent hires a verified human through ENS and locks the USDC in escrow on Arc. Every on-chain step is a live, clickable link.",
  },
  {
    src: "/shots/resolved.png",
    alt: "WARD resolved: Chainlink CRE attested the fix, escrow released to the worker, all devices healthy",
    cap: "A Chainlink oracle confirms the sensor reads dry, and the escrow pays the worker. No human approved it.",
  },
];

export function InAction() {
  return (
    <section
      id="in-action"
      className="flex min-h-svh scroll-mt-16 items-center border-b border-border bg-bg"
    >
      <div className="reveal mx-auto w-full max-w-5xl px-6 py-24 md:py-28">
        <div className="label">See it run</div>
        <h2 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight text-fg md:text-5xl">
          One incident, from leak to settled, on-chain.
        </h2>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-muted">
          2am leak, owner asleep in another timezone. WARD tries a remote fix,
          can&apos;t stop a burst pipe, hires a plumber, locks the escrow, and
          releases when the sensor reads dry. The hire-escrow-release settles in
          about 27 seconds. Every step verifiable on-chain.
        </p>

        <div className="mt-7 grid gap-5 md:grid-cols-2">
          {SHOTS.map((s) => (
            <figure
              key={s.src}
              className="hover-lift overflow-hidden rounded-sm border border-border bg-surface"
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
            className="cta-dispatch inline-flex items-center gap-1.5 text-[14px] font-semibold text-accent-ink transition-colors hover:text-accent"
          >
            Demo <span className="cta-arrow" aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
