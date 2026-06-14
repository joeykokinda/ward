import { Droplets, Lock, Thermometer, Wifi } from "lucide-react";

// Hero side panel: a compact live device console. Three devices healthy, the
// leak sensor tripping, and the agent already responding on-chain — the whole
// WARD loop in one glance. Illustrative (the live product is at /demo).
const DEVICES: {
  Icon: typeof Wifi;
  name: string;
  room: string;
  alert?: boolean;
}[] = [
  { Icon: Wifi, name: "WiFi router", room: "Living room" },
  { Icon: Thermometer, name: "Thermostat", room: "Hallway" },
  { Icon: Lock, name: "Front-door lock", room: "Entry" },
  { Icon: Droplets, name: "Leak sensor", room: "Laundry & bath", alert: true },
];

export function HomeConsole({ className = "" }: { className?: string }) {
  return (
    <div
      className={`overflow-hidden rounded-sm border border-border bg-bg/85 ${className}`}
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2">
          <span className="dot bg-success ward-live-dot" aria-hidden />
          <span className="text-[13px] font-medium text-fg-soft">Home · live</span>
        </div>
        <span className="mono text-[12px] text-faint">ward-agent.eth</span>
      </div>

      <div className="divide-y divide-border">
        {DEVICES.map((d) => (
          <div key={d.name} className="flex items-center gap-3.5 px-5 py-3.5">
            <span
              className={`flex h-10 w-10 flex-none items-center justify-center rounded-sm ${
                d.alert ? "bg-accent-soft text-accent-ink" : "bg-subtle text-muted"
              }`}
            >
              <d.Icon className="h-[18px] w-[18px]" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-medium text-fg">{d.name}</div>
              <div className="text-[12px] text-faint">{d.room}</div>
            </div>
            {d.alert ? (
              <span className="inline-flex items-center gap-1.5 rounded-sm bg-accent-soft px-2.5 py-1 text-[12px] font-medium text-accent-ink">
                <span className="dot bg-accent ward-live-dot" aria-hidden />
                Leak
              </span>
            ) : (
              <span className="text-[12px] font-medium text-success-ink">Healthy</span>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-border px-5 py-4">
        <div className="text-[13px] leading-relaxed text-fg-soft">
          <span className="font-semibold text-accent-ink">WARD</span> hired a
          plumber and paid <span className="mono">150 USDC</span> on Arc.
        </div>
      </div>
    </div>
  );
}
