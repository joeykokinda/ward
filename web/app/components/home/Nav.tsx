import Link from "next/link";
import { WardMark } from "../WardMark";

// In-page section anchors (smooth-scroll via globals scroll-behavior).
const SECTIONS: { label: string; href: string }[] = [
  { label: "How it works", href: "#how" },
  { label: "In action", href: "#in-action" },
  { label: "Identity", href: "#identity" },
  { label: "Why crypto", href: "#why" },
  { label: "Roadmap", href: "#roadmap" },
];

// Floating pill nav: a contained, rounded island that sticks just below the top.
export function Nav() {
  return (
    <div className="sticky top-0 z-40 px-4 pt-4">
      <nav className="mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-full border border-border bg-bg/80 py-1.5 pl-2.5 pr-1.5 backdrop-blur card-shadow-lg">
        <Link href="#top" className="flex flex-none items-center gap-2 pl-1">
          <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-accent">
            <WardMark className="h-[18px] w-[18px]" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-fg">WARD</span>
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          {SECTIONS.map((s) => (
            <a
              key={s.href}
              href={s.href}
              className="text-[13px] font-medium text-muted transition-colors hover:text-fg"
            >
              {s.label}
            </a>
          ))}
        </div>

        <Link
          href="/demo"
          className="cta-dispatch flex-none rounded-full bg-accent px-4 py-1.5 text-[13px] font-semibold text-[#0a0a0f] transition-colors hover:bg-accent-hover"
        >
          Demo{" "}
          <span className="cta-arrow" aria-hidden>
            &rarr;
          </span>
        </Link>
      </nav>
    </div>
  );
}
