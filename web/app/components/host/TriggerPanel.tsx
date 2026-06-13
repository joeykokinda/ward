"use client";

import Link from "next/link";
import {
  ArrowRight,
  Droplet,
  Lock,
  RotateCcw,
  Thermometer,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import type { WardSnapshot } from "@/lib/data/types";

const DEVICES: { id: string; label: string; Icon: LucideIcon; hero?: boolean }[] = [
  { id: "home-leak", label: "Trigger leak", Icon: Droplet, hero: true },
  { id: "home-wifi", label: "Kill WiFi", Icon: WifiOff },
  { id: "home-lock", label: "Lock failure", Icon: Lock },
  { id: "home-thermostat", label: "HVAC fault", Icon: Thermometer },
];

// Presenter control bar: trip any of the four devices to start an incident, or
// reset to a clean pre-staged state. The leak is the hero (amber).
export function TriggerPanel({
  snapshot,
  isRunning,
  onTrigger,
  onReset,
}: {
  snapshot: WardSnapshot;
  isRunning: boolean;
  onTrigger: (deviceId: string) => void;
  onReset: () => void;
}) {
  const faulted = (id: string) => {
    const p = snapshot.properties.find((d) => d.id === id);
    return p ? p.device.faultMode !== "none" : false;
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-sm border border-border bg-surface px-3 py-2.5 card-shadow">
      <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
        Trigger a fault
      </span>
      {DEVICES.map((d) => {
        const disabled = isRunning || faulted(d.id);
        return (
          <button
            key={d.id}
            onClick={() => onTrigger(d.id)}
            disabled={disabled}
            className={`inline-flex items-center gap-2 rounded-sm px-3 py-2 text-[12px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              d.hero
                ? "bg-accent text-[#0a0a0f] hover:bg-accent-hover"
                : "border border-border bg-subtle text-fg-soft hover:border-border-strong hover:bg-surface"
            }`}
          >
            <d.Icon className="h-4 w-4" strokeWidth={2} />
            {d.label}
          </button>
        );
      })}
      <div className="ml-auto flex items-center gap-2">
        <Link
          href="/live"
          className="inline-flex items-center gap-1.5 rounded-sm border border-success/50 bg-success-soft px-3 py-2 text-[12px] font-semibold text-success-ink transition-colors hover:bg-surface"
        >
          <span className="dot bg-success ward-live-dot" aria-hidden />
          Run it live
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
        <button
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-sm border border-border px-3 py-2 text-[12px] font-medium text-muted transition-colors hover:bg-subtle hover:text-fg"
        >
          <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
          Reset
        </button>
      </div>
    </div>
  );
}
