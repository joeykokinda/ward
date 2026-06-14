import Link from "next/link";
import { HomeConsole } from "./HomeConsole";
import { FaultyTerminal } from "./FaultyTerminal";

const HEADLINE = [
  "Your home fixes itself.",
  "Hires a human when it can't.",
  "Pays them on-chain.",
];

export function Hero() {
  return (
    <section
      id="top"
      className="relative flex min-h-svh items-center overflow-hidden border-b border-border bg-bg"
    >
      <FaultyTerminal
        className="pointer-events-none absolute inset-0 h-full w-full"
        scale={1}
        digitSize={1.6}
        scanlineIntensity={0.3}
        glitchAmount={0.8}
        flickerAmount={0.8}
        curvature={0.2}
        tint="#f59e0b"
        brightness={0.7}
        mouseReact
        mouseStrength={0.2}
      />
      <div className="pointer-events-none absolute inset-0 bg-bg/70" />
      <div className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-12 px-6 py-24 md:grid-cols-[1.55fr_1fr] md:py-28">
        <div>
          <div className="label mono mb-4 text-accent-ink">
            INCOMING · ward-agent.eth
          </div>
          <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-fg md:text-5xl">
            {HEADLINE.map((line, i) => (
              <span
                key={line}
                className={`hero-rise block ${i === HEADLINE.length - 1 ? "text-fg-soft" : ""}`}
                style={{ animationDelay: `${0.08 + i * 0.13}s` }}
              >
                {line}
              </span>
            ))}
          </h1>
          <p className="ward-boot ward-boot-1 mt-6 max-w-md text-base leading-relaxed text-fg-soft md:text-lg">
            Settled on-chain the moment a sensor confirms the fix &mdash; no
            invoice, no approval. You wake up to a receipt, not a flood.
          </p>
          <div className="ward-boot ward-boot-2 mt-9">
            <Link
              href="/live"
              className="cta-dispatch inline-flex items-center gap-2 rounded-sm bg-accent px-5 py-3 text-sm font-semibold text-[#0a0a0f] transition-colors hover:bg-accent-hover"
            >
              Try it live{" "}
              <span className="cta-arrow" aria-hidden>
                &rarr;
              </span>
            </Link>
            <a
              href="#see-it-run"
              className="ml-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-fg"
            >
              Watch the demo ↓
            </a>
          </div>
        </div>

        <div className="ward-boot ward-boot-3 flex flex-col items-center md:items-end">
          <HomeConsole className="w-full max-w-md card-shadow-lg" />
        </div>
      </div>
    </section>
  );
}
