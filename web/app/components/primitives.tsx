import type { LogType, JobState } from "@/lib/data/types";

// --- Panel: the base bordered surface. 1px #1e1e2e border, 4px radius. ---
export function Panel({
  title,
  right,
  children,
  className = "",
  bodyClassName = "",
}: {
  title?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`flex min-h-0 flex-col border border-border bg-panel rounded-[4px] ${className}`}
    >
      {title !== undefined && (
        <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <span className="label">{title}</span>
          {right}
        </header>
      )}
      <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

// --- Status dot, always paired with a text label by callers. ---
export function Dot({ tone }: { tone: "green" | "amber" | "red" | "muted" }) {
  const bg =
    tone === "green"
      ? "bg-green"
      : tone === "amber"
        ? "bg-amber"
        : tone === "red"
          ? "bg-red"
          : "bg-muted";
  return <span className={`dot ${bg}`} aria-hidden />;
}

// --- Color map for log line types (exact DESIGN.md spec). ---
export const LOG_COLOR: Record<LogType, string> = {
  MONITOR: "text-muted",
  DIAGNOSE: "text-blue",
  ACTION: "text-amber",
  RESULT: "text-text",
  ESCROW: "text-amber font-bold",
  DISPATCH: "text-green",
  RESOLVED: "text-green font-bold",
};

// --- Job state -> tone (paired with text, never color-only). ---
export function jobStateTone(state: JobState): "green" | "amber" | "red" | "muted" {
  switch (state) {
    case "SETTLED":
      return "green";
    case "EXPIRED":
    case "REFUNDED":
      return "red";
    case "OPEN":
    case "ACCEPTED":
    case "WORK_DONE":
    case "ATTESTING":
      return "amber";
    default:
      return "muted";
  }
}

// --- Inline money in amber, monospace, tabular. ---
export function Money({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`mono text-amber ${className}`}>
      {children}
      <span className="ml-1 text-[10px] text-amber/70">USDC</span>
    </span>
  );
}
