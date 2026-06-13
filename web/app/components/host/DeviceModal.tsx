"use client";

import {
  Droplet,
  Lock,
  Power,
  Thermometer,
  Wifi,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import type { DeviceKind, PropertyStatus } from "@/lib/data/types";
import { formatDuration, signalLabel } from "@/lib/format";
import { Chip, type Tone } from "../primitives";

const KIND_ICON: Record<DeviceKind, LucideIcon> = {
  router: Wifi,
  thermostat: Thermometer,
  lock: Lock,
  leak_sensor: Droplet,
};

const KIND_KILL_LABEL: Record<DeviceKind, string> = {
  router: "Kill WiFi router",
  thermostat: "Trip thermostat fault",
  lock: "Trip lock fault",
  leak_sensor: "Trigger water leak",
};

// What the device monitors / does, in plain language.
const KIND_DESC: Record<DeviceKind, string> = {
  router: "Home internet uplink. Heartbeat every 30s; WARD can remote-reboot it.",
  thermostat: "Heat/cool setpoint + relay. WARD can remote-cycle the relay.",
  lock: "Front-door bolt + access log. WARD can remote re-pair it.",
  leak_sensor:
    "Water-ingress sensor under the laundry/bathroom floor. No remote actuator can stop a physical leak — this one always needs a human.",
};

function tone(p: PropertyStatus): Tone {
  if (!p.device.online || p.device.faultMode === "hard") return "danger";
  if (p.device.faultMode === "soft") return "warn";
  return "accent";
}

function statusText(p: PropertyStatus): string {
  if (!p.device.online) return "Offline";
  if (p.device.faultMode !== "none") return "Degraded";
  return "Healthy";
}

export function DeviceModal({
  property,
  liveUptimeSec,
  busy,
  onKill,
}: {
  property: PropertyStatus;
  liveUptimeSec: number;
  busy: boolean; // a scenario is mid-flight -> kill disabled
  onKill: () => void;
}) {
  const faulted = !property.device.online || property.device.faultMode !== "none";
  const Icon = faulted && property.deviceKind === "router" ? WifiOff : KIND_ICON[property.deviceKind];
  const hasSignal = property.deviceKind !== "leak_sensor";

  return (
    <div className="p-5">
      <div className="flex items-start gap-3 pr-8">
        <span
          className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl ${
            faulted ? "bg-danger-soft text-danger" : "bg-accent-soft text-accent-ink"
          }`}
        >
          <Icon className="h-5 w-5" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h3 id="device-modal-title" className="text-[17px] font-semibold text-fg">
            {property.name}
          </h3>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="mono text-[12px] text-muted">{property.deviceId}</span>
            <Chip tone={tone(property)}>{statusText(property)}</Chip>
          </div>
        </div>
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-muted">
        {KIND_DESC[property.deviceKind]}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stat label="Region" value={property.region} />
        <Stat
          label="Uptime"
          value={
            property.device.online ? formatDuration(liveUptimeSec) : "—"
          }
          mono
        />
        {hasSignal ? (
          <Stat
            label="Signal"
            value={
              property.device.online
                ? `${property.device.signalDbm} dBm · ${signalLabel(property.device.signalDbm).toLowerCase()}`
                : "none"
            }
            mono
          />
        ) : (
          <Stat
            label="Sensor"
            value={property.device.online ? "armed" : "wet · fault"}
            mono
          />
        )}
        <Stat
          label="Fault mode"
          value={property.device.faultMode}
          mono
          danger={property.device.faultMode !== "none"}
        />
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <button
          onClick={onKill}
          disabled={busy || faulted}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-danger/30 bg-danger-soft py-3 text-[14px] font-semibold text-danger transition-colors hover:bg-danger hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-danger-soft disabled:hover:text-danger"
        >
          <Power className="h-4 w-4" strokeWidth={2.2} />
          {faulted
            ? "Incident already in flight"
            : busy
              ? "Another incident running…"
              : KIND_KILL_LABEL[property.deviceKind]}
        </button>
        <p className="mt-2 text-center text-[11px] text-faint">
          Simulates a real-world fault. WARD detects it, tries a remote fix, then
          hires + pays a verified human if it can&apos;t.
        </p>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  mono = false,
  danger = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="rounded-lg bg-subtle px-3 py-2.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted">
        {label}
      </div>
      <div
        className={`mt-0.5 text-[13px] ${mono ? "mono" : ""} ${
          danger ? "font-semibold text-danger" : "text-fg-soft"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
