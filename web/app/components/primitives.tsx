import type { LogType, JobState } from "@/lib/data/types";

// --- Card: the base light surface. Soft border, gentle radius, subtle shadow. ---
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
      className={`flex min-h-0 flex-col rounded-xl border border-border bg-surface card-shadow ${className}`}
    >
      {title !== undefined && (
        <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="text-[13px] font-semibold text-fg-soft">{title}</h2>
          {right}
        </header>
      )}
      <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

export type Tone = "accent" | "danger" | "warn" | "muted";

// --- Status dot, always paired with a text label by callers. ---
export function Dot({ tone, pulse = false }: { tone: Tone; pulse?: boolean }) {
  const bg =
    tone === "accent"
      ? "bg-accent"
      : tone === "danger"
        ? "bg-danger"
        : tone === "warn"
          ? "bg-warn"
          : "bg-faint";
  return <span className={`dot ${bg} ${pulse ? "ward-live-dot" : ""}`} aria-hidden />;
}

// Text color per tone.
export function toneText(tone: Tone): string {
  switch (tone) {
    case "accent":
      return "text-accent-ink";
    case "danger":
      return "text-danger";
    case "warn":
      return "text-warn";
    default:
      return "text-muted";
  }
}

// --- Log line types collapsed to a calm 2–3 tone scheme (DESIGN.md v2). ---
// Routine telemetry is muted; key escrow/resolution events get the accent.
export function logTone(type: LogType): Tone {
  switch (type) {
    case "ESCROW":
    case "DISPATCH":
    case "RESOLVED":
      return "accent";
    default:
      return "muted";
  }
}

// Whether a log type is a "key" event (gets emphasis + accent in the timeline).
export function isKeyEvent(type: LogType): boolean {
  return type === "ESCROW" || type === "DISPATCH" || type === "RESOLVED";
}

// --- Job state -> tone (paired with text, never color-only). ---
export function jobStateTone(state: JobState): Tone {
  switch (state) {
    case "SETTLED":
      return "accent";
    case "EXPIRED":
    case "REFUNDED":
      return "danger";
    case "OPEN":
    case "ACCEPTED":
    case "WORK_DONE":
    case "ATTESTING":
      return "warn";
    default:
      return "muted";
  }
}

// --- A soft chip / pill for statuses and tags. ---
export function Chip({
  tone = "muted",
  children,
  className = "",
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  const styles =
    tone === "accent"
      ? "bg-accent-soft text-accent-ink"
      : tone === "danger"
        ? "bg-danger-soft text-danger"
        : tone === "warn"
          ? "bg-warn-soft text-warn"
          : "bg-subtle text-muted";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${styles} ${className}`}
    >
      {children}
    </span>
  );
}

// --- Inline money. Monospace + tabular for the digits, neutral "USDC" label. ---
export function Money({
  children,
  className = "",
  unitClassName = "",
}: {
  children: React.ReactNode;
  className?: string;
  unitClassName?: string;
}) {
  return (
    <span className={`mono font-semibold text-fg ${className}`}>
      {children}
      <span className={`ml-1 font-sans text-[0.72em] font-medium text-muted ${unitClassName}`}>
        USDC
      </span>
    </span>
  );
}
