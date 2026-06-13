import Link from "next/link";
import { WardMark } from "../WardMark";

// Thin sticky top nav: wordmark left, primary amber demo link right.
export function Nav() {
  return (
    <nav className="sticky top-0 z-30 border-b border-border bg-bg/95 backdrop-blur-none">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-accent">
            <WardMark className="h-[18px] w-[18px]" />
          </span>
          <span className="text-[16px] font-semibold tracking-tight text-fg">WARD</span>
        </div>
        <Link
          href="/demo"
          className="rounded-sm bg-accent px-3.5 py-1.5 text-[13px] font-semibold text-[#0a0a0f] transition-colors hover:bg-accent-hover"
        >
          Watch the demo &rarr;
        </Link>
      </div>
    </nav>
  );
}
