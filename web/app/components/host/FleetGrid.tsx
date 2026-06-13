"use client";

import type { PropertyStatus } from "@/lib/data/types";
import { formatDuration, signalLabel } from "@/lib/format";
import { Dot, Panel } from "../primitives";

function deviceTone(p: PropertyStatus): "green" | "amber" | "red" {
  if (!p.device.online || p.device.faultMode === "hard") return "red";
  if (p.device.faultMode === "soft") return "amber";
  return "green";
}

function statusText(p: PropertyStatus): string {
  if (!p.device.online) return "OFFLINE";
  if (p.device.faultMode !== "none") return "DEGRADED";
  return "HEALTHY";
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

  return (
    <Panel
      title="Fleet"
      right={
        <span className="mono text-[11px] text-muted">
          <span className={healthy === properties.length ? "text-green" : "text-amber"}>
            {healthy}
          </span>
          /{properties.length} healthy
        </span>
      }
      className="h-full"
      bodyClassName="overflow-auto ward-scroll"
    >
      <div className="divide-y divide-border">
        {/* column header row */}
        <div className="grid grid-cols-[1fr_auto] gap-2 px-3 py-1.5">
          <span className="label">Property</span>
          <span className="label text-right">Status</span>
        </div>
        {properties.map((p) => {
          const tone = deviceTone(p);
          const status = statusText(p);
          const offline = !p.device.online;
          const uptime = offline ? 0 : (liveUptime[p.id] ?? p.device.uptimeSec);
          return (
            <div
              key={p.id}
              className={`px-3 py-2.5 ${offline ? "bg-red/5" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Dot tone={tone} />
                  <span
                    className={`mono text-[13px] truncate ${
                      offline ? "text-text" : "text-text"
                    }`}
                  >
                    {p.name}
                  </span>
                </div>
                <span
                  className={`mono text-[11px] font-semibold ${
                    tone === "green"
                      ? "text-green"
                      : tone === "red"
                        ? "text-red"
                        : "text-amber"
                  }`}
                >
                  {status}
                </span>
              </div>
              {/* dense data row */}
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                <DataCell label="Device" value={p.deviceId} mono />
                <DataCell
                  label="Uptime"
                  value={offline ? "—" : formatDuration(uptime)}
                  tone={offline ? "muted" : "text"}
                />
                <DataCell
                  label="Signal"
                  value={
                    offline
                      ? "NONE"
                      : `${p.device.signalDbm}dBm`
                  }
                  sub={offline ? undefined : signalLabel(p.device.signalDbm)}
                  tone={offline ? "muted" : "text"}
                />
              </div>
              <div className="mt-1 label">{p.region}</div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function DataCell({
  label,
  value,
  sub,
  mono = true,
  tone = "text",
}: {
  label: string;
  value: string;
  sub?: string;
  mono?: boolean;
  tone?: "text" | "muted";
}) {
  return (
    <div className="min-w-0">
      <div className="label leading-none">{label}</div>
      <div
        className={`${mono ? "mono" : ""} mt-0.5 truncate text-[12px] ${
          tone === "muted" ? "text-muted" : "text-text"
        }`}
        title={value}
      >
        {value}
      </div>
      {sub && <div className="label leading-none">{sub}</div>}
    </div>
  );
}
