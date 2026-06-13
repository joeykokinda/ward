import Link from "next/link";
import { FloorPlanTeaser } from "./FloorPlanTeaser";

export function Hero() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto grid max-w-5xl items-center gap-12 px-6 py-20 md:grid-cols-2 md:py-28">
        <div>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-fg md:text-5xl">
            Your home runs itself.
          </h1>
          <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-fg-soft md:text-base">
            An autonomous agent that watches every device, fixes what it can, and
            hires and pays a verified human when it cannot. Settled on-chain.
          </p>
          <div className="mt-9">
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 rounded-sm bg-accent px-5 py-3 text-sm font-semibold text-[#0a0a0f] transition-colors hover:bg-accent-hover"
            >
              Watch the demo &rarr;
            </Link>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 md:items-end">
          <div className="w-full max-w-sm rounded-sm border border-border bg-surface p-4">
            <FloorPlanTeaser className="h-auto w-full" />
          </div>
          <div className="flex items-center gap-2 text-[11px] text-faint">
            <span className="dot bg-success" aria-hidden />
            <span>4 devices, all healthy</span>
          </div>
        </div>
      </div>
    </section>
  );
}
