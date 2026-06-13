"use client";

import { useEffect, useRef, useState } from "react";
import {
  Droplet,
  Lock,
  Thermometer,
  Wifi,
  WifiOff,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { DeviceKind, PropertyStatus, WardSnapshot } from "@/lib/data/types";
import {
  avatarTarget,
  deriveIncident,
  deviceVisual,
  ENTRY,
  isBeingFixed,
  ROOMS,
  roomFor,
  VIEW_H,
  VIEW_W,
  workerPathD,
  type Incident,
  type Room,
} from "@/lib/floorplan";

const KIND_ICON: Record<DeviceKind, LucideIcon> = {
  router: Wifi,
  thermostat: Thermometer,
  lock: Lock,
  leak_sensor: Droplet,
};

const COLOR = {
  wall: "#cbd5e1",
  wallFill: "#ffffff",
  roomFill: "#fafafa",
  label: "#64748b",
  faint: "#94a3b8",
  healthy: "#84cc16",
  healthyInk: "#3f6212",
  alert: "#dc2626",
  alertSoft: "#fef2f2",
  water: "#3b82f6",
  waterSoft: "#dbeafe",
  warm: "#f59e0b",
  warmSoft: "#fffbeb",
  ink: "#0f172a",
  worker: "#84cc16",
} as const;

export function FloorPlan({
  snapshot,
  onKillDevice,
  onDeviceClick,
  onWorkerClick,
}: {
  snapshot: WardSnapshot;
  onKillDevice: (deviceId: string) => void;
  onDeviceClick: (deviceId: string) => void;
  onWorkerClick: () => void;
}) {
  void onKillDevice; // kill happens inside the device modal; kept for parity
  const incident = deriveIncident(snapshot.activeJob, snapshot.properties);
  const byId = Object.fromEntries(snapshot.properties.map((p) => [p.id, p]));

  return (
    <section className="flex min-h-0 flex-col rounded-xl border border-border bg-surface card-shadow">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="text-[13px] font-semibold text-fg-soft">Apartment · Brooklyn, NY</h2>
        <LiveLegend incident={incident} />
      </header>
      <div className="min-h-0 flex-1 p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="h-auto w-full select-none"
          role="img"
          aria-label="Apartment floor plan with four monitored devices"
        >
          {/* apartment outer shell */}
          <rect
            x={28}
            y={28}
            width={VIEW_W - 56}
            height={VIEW_H - 56}
            rx={16}
            fill={COLOR.wallFill}
            stroke={COLOR.wall}
            strokeWidth={3}
          />

          {/* rooms */}
          {ROOMS.map((room) => {
            const p = byId[room.deviceId] as PropertyStatus | undefined;
            if (!p) return null;
            const beingFixed = isBeingFixed(incident, room.deviceId);
            return (
              <RoomCell
                key={room.deviceId}
                room={room}
                property={p}
                beingFixed={beingFixed}
                onClick={() => onDeviceClick(room.deviceId)}
              />
            );
          })}

          {/* front door marker on the entry edge */}
          <DoorMarker />

          {/* worker path + avatar (only while an incident worker is on site) */}
          <WorkerLayer incident={incident} onClick={onWorkerClick} />
        </svg>
      </div>
    </section>
  );
}

function LiveLegend({ incident }: { incident: Incident }) {
  const label =
    incident.phase === "idle"
      ? "All systems nominal"
      : incident.phase === "dispatched"
        ? "Escrow funded · tech selected"
        : incident.phase === "enroute"
          ? "Tech en route"
          : incident.phase === "fixing"
            ? "Repair in progress"
            : "Resolving";
  const calm = incident.phase === "idle";
  return (
    <span className="flex items-center gap-2 text-[12px]">
      <span
        className={`dot ${calm ? "bg-accent ward-live-dot" : "bg-warn ward-live-dot"}`}
        aria-hidden
      />
      <span className={calm ? "text-accent-ink" : "text-warn"}>{label}</span>
    </span>
  );
}

// ───────────────────────────── a room + its device ─────────────────────────

function RoomCell({
  room,
  property,
  beingFixed,
  onClick,
}: {
  room: Room;
  property: PropertyStatus;
  beingFixed: boolean;
  onClick: () => void;
}) {
  const visual = deviceVisual(property, beingFixed);
  const alert = visual === "alert";

  // remember the previous online state to flash a heal-pulse on recovery
  const wasAlert = useRef(false);
  const [healKey, setHealKey] = useState(0);
  useEffect(() => {
    if (wasAlert.current && !alert) setHealKey((k) => k + 1);
    wasAlert.current = alert;
  }, [alert]);

  const roomTint =
    room.kind === "leak_sensor" && alert
      ? COLOR.waterSoft
      : room.kind === "thermostat" && alert
        ? COLOR.warmSoft
        : alert
          ? COLOR.alertSoft
          : COLOR.roomFill;

  return (
    <g className="cursor-pointer" onClick={onClick}>
      {/* room rectangle */}
      <rect
        x={room.x}
        y={room.y}
        width={room.w}
        height={room.h}
        rx={10}
        fill={roomTint}
        stroke={COLOR.wall}
        strokeWidth={2}
      />

      {/* heal flash on recovery */}
      {healKey > 0 && (
        <rect
          key={healKey}
          x={room.x}
          y={room.y}
          width={room.w}
          height={room.h}
          rx={10}
          className="ward-heal-flash"
          fill={COLOR.healthy}
          pointerEvents="none"
        />
      )}

      {/* room label */}
      <text
        x={room.x + 14}
        y={room.y + 24}
        fontSize={13}
        fontWeight={600}
        fill={COLOR.label}
        style={{ fontFamily: "var(--font-inter)" }}
      >
        {room.label}
      </text>

      {/* room-specific animation layer (behind the icon) */}
      {alert && <RoomAnimation room={room} />}

      {/* the device icon + label + status */}
      <DeviceNode room={room} visual={visual} />
    </g>
  );
}

// ─────────────────── room-specific, light-friendly animations ───────────────

function RoomAnimation({ room }: { room: Room }) {
  const { x: cx, y: cy } = room.device;
  switch (room.kind) {
    case "leak_sensor":
      // HERO: blue concentric ripples + a faint blue water-tint fill.
      return (
        <g pointerEvents="none">
          {/* breathing water tint pooled around the sensor */}
          <ellipse
            cx={cx}
            cy={cy + 40}
            rx={room.w * 0.42}
            ry={42}
            fill={COLOR.water}
            className="ward-water-tint"
          />
          {[0, 1, 2].map((i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={6}
              fill="none"
              stroke={COLOR.water}
              className={`ward-ripple ${i === 1 ? "ward-ripple-2" : i === 2 ? "ward-ripple-3" : ""}`}
            />
          ))}
        </g>
      );
    case "router":
      // WiFi: signal arcs that fade out (router down) + a no-signal marker.
      return (
        <g pointerEvents="none">
          {[18, 30, 42].map((r, i) => (
            <path
              key={r}
              d={describeArc(cx, cy + 6, r, -130, -50)}
              fill="none"
              stroke={COLOR.faint}
              strokeWidth={2.5}
              strokeLinecap="round"
              className="ward-arc-out"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </g>
      );
    case "lock":
      // Lock: red pulse ring on the door device.
      return (
        <g pointerEvents="none">
          <circle
            cx={cx}
            cy={cy}
            r={26}
            fill="none"
            stroke={COLOR.alert}
            strokeWidth={2.5}
            className="ward-alert-ring"
          />
        </g>
      );
    case "thermostat":
      // Thermostat: warm tint handled by the room fill; the flashing number is
      // rendered in DeviceNode. Add a soft pulse ring for motion.
      return (
        <g pointerEvents="none">
          <circle
            cx={cx}
            cy={cy}
            r={26}
            fill="none"
            stroke={COLOR.warm}
            strokeWidth={2.5}
            className="ward-alert-ring"
          />
        </g>
      );
    default:
      return null;
  }
}

// ───────────────────────────── device icon node ─────────────────────────────

function DeviceNode({
  room,
  visual,
}: {
  room: Room;
  visual: "healthy" | "alert" | "being_fixed";
}) {
  const { x: cx, y: cy } = room.device;
  const alert = visual === "alert";
  const fixing = visual === "being_fixed";

  const Icon = alert && room.kind === "router" ? WifiOff : KIND_ICON[room.kind];

  const ring =
    alert && room.kind === "leak_sensor"
      ? COLOR.water
      : alert && room.kind === "thermostat"
        ? COLOR.warm
        : alert
          ? COLOR.alert
          : COLOR.healthy;
  const fill =
    alert && room.kind === "leak_sensor"
      ? COLOR.waterSoft
      : alert && room.kind === "thermostat"
        ? COLOR.warmSoft
        : alert
          ? COLOR.alertSoft
          : "#ffffff";

  const statusText =
    fixing
      ? "fixing…"
      : room.kind === "lock"
        ? alert
          ? "lock: unknown"
          : "locked"
        : room.kind === "leak_sensor"
          ? alert
            ? "water detected"
            : "dry · armed"
          : room.kind === "router"
            ? alert
              ? "no signal"
              : "online"
            : alert
              ? "11°C · off-target"
              : "21°C";
  const statusColor = fixing
    ? COLOR.healthyInk
    : alert
      ? room.kind === "leak_sensor"
        ? COLOR.water
        : room.kind === "thermostat"
          ? COLOR.warm
          : COLOR.alert
      : COLOR.healthyInk;

  return (
    <g>
      {/* device puck */}
      <circle cx={cx} cy={cy} r={22} fill={fill} stroke={ring} strokeWidth={2.5} />
      <foreignObject x={cx - 11} y={cy - 11} width={22} height={22}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 22,
            height: 22,
            color: alert ? ring : COLOR.ink,
          }}
        >
          <Icon size={16} strokeWidth={2} />
        </div>
      </foreignObject>

      {/* healthy status dot (calm) */}
      {!alert && !fixing && (
        <circle
          cx={cx + 18}
          cy={cy - 16}
          r={4}
          fill={COLOR.healthy}
          className="ward-healthy-breath"
        />
      )}

      {/* thermostat off-target flashing number overrides the status line */}
      {alert && room.kind === "thermostat" ? (
        <text
          x={cx}
          y={cy + 42}
          textAnchor="middle"
          fontSize={13}
          fontWeight={700}
          fill={COLOR.warm}
          className="ward-temp-flash"
          style={{ fontFamily: "var(--font-mono-geist)" }}
        >
          11°C
        </text>
      ) : (
        <text
          x={cx}
          y={cy + 42}
          textAnchor="middle"
          fontSize={12}
          fontWeight={alert ? 700 : 600}
          fill={statusColor}
          style={{ fontFamily: "var(--font-inter)" }}
        >
          {statusText}
        </text>
      )}

      {/* device label */}
      <text
        x={cx}
        y={cy + 60}
        textAnchor="middle"
        fontSize={12}
        fill={COLOR.label}
        style={{ fontFamily: "var(--font-inter)" }}
      >
        {room.deviceLabel}
      </text>
    </g>
  );
}

// ───────────────────────────── front-door marker ───────────────────────────

function DoorMarker() {
  return (
    <g pointerEvents="none">
      {/* a gap on the outer wall near the entry, with a swing arc */}
      <line
        x1={ENTRY.x - 4}
        y1={28}
        x2={ENTRY.x - 4}
        y2={28 + 44}
        stroke={COLOR.wallFill}
        strokeWidth={6}
      />
      <path
        d={describeArc(ENTRY.x - 4, 28, 44, 90, 150)}
        fill="none"
        stroke={COLOR.faint}
        strokeWidth={1.5}
        strokeDasharray="3 3"
      />
    </g>
  );
}

// ───────────────────────────── worker avatar layer ─────────────────────────

function WorkerLayer({
  incident,
  onClick,
}: {
  incident: Incident;
  onClick: () => void;
}) {
  const { visible, point, atDevice } = avatarTarget(incident);
  const initial = incident.workerEns?.[0]?.toUpperCase() ?? "W";
  const room = incident.deviceId ? roomFor(incident.deviceId) : undefined;

  // Keep the avatar on screen for a short beat after it goes invisible so the
  // fade-out reads. We only ever toggle `lingering` inside a timeout callback
  // (an async context), never synchronously in the effect body.
  const [lingering, setLingering] = useState(false);
  const wasVisible = useRef(visible);
  useEffect(() => {
    if (wasVisible.current && !visible) {
      setLingering(true);
      const t = setTimeout(() => setLingering(false), 600);
      wasVisible.current = visible;
      return () => clearTimeout(t);
    }
    wasVisible.current = visible;
  }, [visible]);

  if ((!visible && !lingering) || !room) return null;

  return (
    <g>
      {/* dashed travel path */}
      {incident.phase !== "exit" && (
        <path
          d={workerPathD(incident.deviceId!)}
          fill="none"
          stroke={COLOR.worker}
          strokeWidth={2}
          strokeLinecap="round"
          className="ward-path-march"
          opacity={0.7}
          pointerEvents="none"
        />
      )}

      {/* the avatar — a lime circle with the worker's initial. CSS transitions
          the translate between waypoints, giving a smooth walk. */}
      <g
        className="ward-avatar-in cursor-pointer"
        onClick={onClick}
        style={{
          transform: `translate(${point.x}px, ${point.y}px)`,
          transition: "transform 3.4s cubic-bezier(0.4, 0, 0.2, 1)",
          opacity: visible ? 1 : 0,
        }}
      >
        <circle r={16} fill={COLOR.worker} stroke="#ffffff" strokeWidth={2.5} />
        <text
          textAnchor="middle"
          y={5}
          fontSize={15}
          fontWeight={700}
          fill="#1a2e05"
          style={{ fontFamily: "var(--font-inter)" }}
        >
          {initial}
        </text>

        {/* wrench blip while fixing */}
        {atDevice && (
          <g className="ward-wrench" transform="translate(16,-16)">
            <circle r={11} fill="#ffffff" stroke={COLOR.healthy} strokeWidth={2} />
            <foreignObject x={-8} y={-8} width={16} height={16}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 16,
                  height: 16,
                  color: COLOR.healthyInk,
                }}
              >
                <Wrench size={11} strokeWidth={2.2} />
              </div>
            </foreignObject>
          </g>
        )}
      </g>
    </g>
  );
}

// ───────────────────────────── svg arc helper ──────────────────────────────

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}
