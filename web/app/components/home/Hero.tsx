import Link from "next/link";
import { HomeConsole } from "./HomeConsole";
import { FaultyTerminal } from "./FaultyTerminal";
import { DecodeText } from "./DecodeText";

export function Hero() {
  return (
    <section
      id="top"
      className="relative flex min-h-svh items-center overflow-hidden border-b border-border bg-bg"
    >
      <FaultyTerminal
        className="pointer-events-none absolute inset-0 h-full w-full"
        scale={1}
        digitSize={1.5}
        scanlineIntensity={0.3}
        glitchAmount={1}
        flickerAmount={1}
        curvature={0.2}
        tint="#f59e0b"
        brightness={1}
        mouseReact
        mouseStrength={0.2}
      />
      <div className="pointer-events-none absolute inset-0 bg-bg/55" />
      <div className="relative z-10 mx-auto grid w-full max-w-5xl items-center gap-12 px-6 py-24 md:grid-cols-2 md:py-28">
        <div>
          <div className="label mono mb-4 text-accent-ink">
            INCOMING · ward-agent.eth
          </div>
          <h1 className="font-mono text-4xl font-semibold leading-[1.06] tracking-tight text-fg sm:text-5xl md:text-6xl">
            <DecodeText
              lines={[
                "Your home hired the plumber.",
                "And paid them.",
                "While you slept.",
              ]}
              dimLastLine
            />
          </h1>
          <p className="ward-boot ward-boot-1 mt-6 max-w-xl text-base leading-relaxed text-fg-soft md:text-lg">
            An autonomous agent watches every device, fixes what it can in
            software, and hires + pays a verified human on-chain when it
            can&apos;t. You wake up to a receipt, not a flood. Built for the buyer
            that can&apos;t open a bank account: software with a wallet.
          </p>
          <div className="ward-boot ward-boot-2 mt-9">
            <Link
              href="/demo"
              className="cta-dispatch inline-flex items-center gap-2 rounded-sm bg-accent px-5 py-3 text-sm font-semibold text-[#0a0a0f] transition-colors hover:bg-accent-hover"
            >
              Demo{" "}
              <span className="cta-arrow" aria-hidden>
                &rarr;
              </span>
            </Link>
          </div>
        </div>

        <div className="ward-boot ward-boot-3 flex flex-col items-center md:items-end">
          <HomeConsole className="w-full max-w-sm card-shadow-lg" />
        </div>
      </div>
    </section>
  );
}
