"use client";

import { Wifi, WifiOff } from "lucide-react";
import type { PropertyStatus } from "@/lib/data/types";
import { formatDuration, signalLabel } from "@/lib/format";
import { Chip, Panel, type Tone } from "../primitives";

function deviceTone(p: PropertyStatus): Tone {
  if (!p.device.online || p.device.faultMode === "hard") return "danger";
  if (p.device.faultMode === "soft") return "warn";
  return "accent";
}

function statusText(p: PropertyStatus): string {
  if (!p.device.online) return "Offline";
  if (p.device.faultMode !== "none") return "Degraded";
  return "Healthy";
}

export function FleetGrid({
  properties,
  liveUptime,
}: {
  properties: PropertyStatus[];
  liveUptime: Record<string, number>;
}) {
  const healthy = properties.filter(
    (p) => p.device.online && p.device.faultMode === "none",
  ).length;
  const allHealthy = healthy === properties.length;

  return (
    <Panel
      title="Properties"
      right={
        <span className="text-[12px] text-muted">
          <span className={allHealthy ? "text-accent-ink" : "text-warn"}>{healthy}</span>
          {" / "}
          {properties.length} healthy
        </span>
      }
      bodyClassName="divide-y divide-border"
    >
      {properties.map((p) => {
        const tone = deviceTone(p);
        const status = statusText(p);
        const offline = !p.device.online;
        const uptime = offline ? 0 : (liveUptime[p.id] ?? p.device.uptimeSec);
        return (
          <div key={p.id} className="flex items-start gap-3 px-4 py-3.5">
            <span
              className={`mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-lg ${
                offline ? "bg-danger-soft text-danger" : "bg-subtle text-muted"
              }`}
            >
              {offline ? (
                <WifiOff className="h-4 w-4" strokeWidth={2} />
              ) : (
                <Wifi className="h-4 w-4" strokeWidth={2} />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[14px] font-medium text-fg">
                  {p.name}
                </span>
                <Chip tone={tone}>{status}</Chip>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-muted">
                <span>{p.region}</span>
                <span className="text-faint">·</span>
                <span className="mono">{p.deviceId}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[12px]">
                <span className="text-muted">
                  Uptime{" "}
                  <span className="mono text-fg-soft">
                    {offline ? "—" : formatDuration(uptime)}
                  </span>
                </span>
                <span className="text-muted">
                  Signal{" "}
                  <span className="mono text-fg-soft">
                    {offline ? "none" : `${p.device.signalDbm} dBm`}
                  </span>
                  {!offline && (
                    <span className="ml-1 text-faint">
                      {signalLabel(p.device.signalDbm).toLowerCase()}
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </Panel>
  );
}
