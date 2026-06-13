import Link from "next/link";
import { WardMark } from "../WardMark";

const LINKS: { label: string; href: string }[] = [
  { label: "GitHub", href: "https://github.com/joeykokinda/ward" },
  {
    label: "WardEscrow on Arc",
    href: "https://testnet.arcscan.app/address/0xe118A51B105DF46F54AE4Fb01a1EF43F6a8dE5D8",
  },
  {
    label: "WorkerRegistry on Arc",
    href: "https://testnet.arcscan.app/address/0x2bdDf43350A5E79cf4fCc2A15f4a6905f9553bB4",
  },
  {
    label: "ENS records (Sepolia)",
    href: "https://sepolia.app.ens.domains/ward-agent.eth",
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-bg">
      <div className="reveal mx-auto w-full max-w-5xl px-6 py-16">
        <h2 className="max-w-3xl text-4xl font-bold tracking-tight text-fg md:text-5xl">
          Watch a 2am leak settle itself.
        </h2>
        <Link
          href="/demo"
          className="cta-dispatch mt-7 inline-flex items-center gap-2 rounded-sm bg-accent px-5 py-3 text-sm font-semibold text-[#0a0a0f] transition-colors hover:bg-accent-hover"
        >
          Demo{" "}
          <span className="cta-arrow" aria-hidden>
            &rarr;
          </span>
        </Link>

        <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-3">
          {LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="text-[13px] text-muted underline decoration-border underline-offset-2 transition-colors hover:text-fg hover:decoration-faint"
            >
              {link.label}
            </a>
          ))}
          <a
            href="#"
            className="text-[13px] text-muted underline decoration-border underline-offset-2 transition-colors hover:text-fg hover:decoration-faint"
          >
            Demo video (soon)
          </a>
        </div>

        <div className="mt-12 flex items-center gap-3 border-t border-border pt-8">
          <span className="flex h-6 w-6 items-center justify-center rounded-sm bg-accent">
            <WardMark className="h-[15px] w-[15px]" />
          </span>
          <span className="text-[13px] font-semibold tracking-tight text-fg">WARD</span>
        </div>
      </div>
    </footer>
  );
}
