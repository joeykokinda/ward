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
import type { DeviceKind, PropertyStatus, WardSnapshot, Worker } from "@/lib/data/types";
import {
  avatarTarget,
  deriveIncident,
  deviceVisual,
  DOOR,
  FLOOR,
  FLOOR_BOTTOM,
  FLOOR_RIGHT,
  isBeingFixed,
  ROOMS,
  roomFor,
  VIEW_H,
  VIEW_W,
  WALLS,
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

// Dark mission-control palette. Structural grays on near-black, faults
// saturated so they pop, amber for active repair, green for recovery/healthy.
const COLOR = {
  // architecture
  outerWall: "#3a3a52", // thick perimeter
  innerWall: "#242438", // hairline partitions
  floor: "#0d0d14", // inset floor slab (darker than the panel)
  label: "#64748b", // room labels — quiet
  // calm device puck (neutral surface)
  puck: "#16161f",
  puckStroke: "#2c2c40",
  puckInk: "#94a3b8",
  reading: "#94a3b8",
  deviceLabel: "#64748b",
  healthyDot: "#22c55e", // green status dot
  // faults (saturated — these "pop" on dark)
  alert: "#ef4444",
  alertSoft: "#2a1414",
  water: "#3b82f6",
  waterSoft: "#0f1a2e",
  warm: "#f59e0b",
  warmSoft: "#2a2008",
  // worker + active repair (amber); recovery flash (green)
  worker: "#f59e0b",
  fixing: "#f59e0b",
  fixingSoft: "#2a2008",
  heal: "#22c55e",
  healInk: "#4ade80",
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
  // The human the agent dispatched — so the walking avatar can be labelled with
  // its real ENS identity + role, not an anonymous dot.
  const dispatchedWorker = incident.workerEns
    ? snapshot.workers.find((w) => w.ensName === incident.workerEns)
    : undefined;

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
          {/* floor slab inside the outer wall */}
          <rect
            x={FLOOR.x}
            y={FLOOR.y}
            width={FLOOR.w}
            height={FLOOR.h}
            fill={COLOR.floor}
          />

          {/* room alert tints (clipped to each room rect; behind walls + labels) */}
          {ROOMS.map((room) => {
            const p = byId[room.deviceId] as PropertyStatus | undefined;
            if (!p) return null;
            const beingFixed = isBeingFixed(incident, room.deviceId);
            const visual = deviceVisual(p, beingFixed);
            return (
              <RoomTint key={`tint-${room.deviceId}`} room={room} alert={visual === "alert"} />
            );
          })}

          {/* shared hairline interior walls (with door-gap openings) */}
          {WALLS.map((w, i) => (
            <line
              key={i}
              x1={w.x1}
              y1={w.y1}
              x2={w.x2}
              y2={w.y2}
              stroke={COLOR.innerWall}
              strokeWidth={2}
              strokeLinecap="round"
            />
          ))}

          {/* thick apartment perimeter, drawn as four segments so the front-door
              opening on the top wall reads as a real gap */}
          <ApartmentShell />

          {/* front door + swing arc at the entry */}
          <DoorMarker />

          {/* rooms: label + device + per-room animation */}
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

          {/* worker path + avatar (only while an incident worker is on site) */}
          <WorkerLayer
            incident={incident}
            worker={dispatchedWorker}
            onClick={onWorkerClick}
          />
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

// ───────────────────── apartment shell (perimeter wall) ─────────────────────

// Four perimeter segments. The top wall is split so the front door reads as a
// real opening in the wall (not a line painted over it).
function ApartmentShell() {
  const segs: string[] = [
    // top-left up to the door
    `M ${FLOOR.x} ${FLOOR.y} L ${DOOR.x} ${FLOOR.y}`,
    // top-right after the door
    `M ${DOOR.x + DOOR.width} ${FLOOR.y} L ${FLOOR_RIGHT} ${FLOOR.y}`,
    // right + bottom + left as one continuous stroke
    `M ${FLOOR_RIGHT} ${FLOOR.y} L ${FLOOR_RIGHT} ${FLOOR_BOTTOM} L ${FLOOR.x} ${FLOOR_BOTTOM} L ${FLOOR.x} ${FLOOR.y}`,
  ];
  return (
    <g pointerEvents="none">
      {segs.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={COLOR.outerWall}
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </g>
  );
}

// ───────────────────────── per-room alert tint ─────────────────────────────

// A soft fault tint that fills only the affected room. Clipped to the room rect
// so the color stays inside the walls. Calm rooms render nothing here.
function RoomTint({ room, alert }: { room: Room; alert: boolean }) {
  if (!alert) return null;
  const fill =
    room.kind === "leak_sensor"
      ? COLOR.waterSoft
      : room.kind === "thermostat"
        ? COLOR.warmSoft
        : COLOR.alertSoft;
  return (
    <rect
      x={room.x}
      y={room.y}
      width={room.w}
      height={room.h}
      fill={fill}
      pointerEvents="none"
    />
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

  return (
    <g className="cursor-pointer" onClick={onClick}>
      {/* invisible hit target so the whole room is clickable */}
      <rect
        x={room.x}
        y={room.y}
        width={room.w}
        height={room.h}
        fill="transparent"
      />

      {/* heal flash on recovery */}
      {healKey > 0 && (
        <rect
          key={healKey}
          x={room.x}
          y={room.y}
          width={room.w}
          height={room.h}
          className="ward-heal-flash"
          fill={COLOR.heal}
          pointerEvents="none"
        />
      )}

      {/* room label */}
      <text
        x={room.labelAt.x}
        y={room.labelAt.y}
        fontSize={12}
        fontWeight={600}
        letterSpacing={0.4}
        fill={COLOR.label}
        style={{ fontFamily: "var(--font-inter)", textTransform: "uppercase" }}
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
      // HERO: blue concentric ripples + a faint blue water-tint pool.
      return (
        <g pointerEvents="none">
          {/* breathing water pool around the sensor */}
          <ellipse
            cx={cx}
            cy={cy + 36}
            rx={86}
            ry={34}
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
      // WiFi: signal arcs that fade out (router down).
      return (
        <g pointerEvents="none">
          {[20, 33, 46].map((r, i) => (
            <path
              key={r}
              d={describeArc(cx, cy + 6, r, -130, -50)}
              fill="none"
              stroke={COLOR.alert}
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
            r={30}
            fill="none"
            stroke={COLOR.alert}
            strokeWidth={2.5}
            className="ward-alert-ring"
          />
        </g>
      );
    case "thermostat":
      // Thermostat: warm pulse ring; the flashing number lives in DeviceNode.
      return (
        <g pointerEvents="none">
          <circle
            cx={cx}
            cy={cy}
            r={30}
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

  // Fault accent for this kind (only used while alerting).
  const faultColor =
    room.kind === "leak_sensor"
      ? COLOR.water
      : room.kind === "thermostat"
        ? COLOR.warm
        : COLOR.alert;
  const faultSoft =
    room.kind === "leak_sensor"
      ? COLOR.waterSoft
      : room.kind === "thermostat"
        ? COLOR.warmSoft
        : COLOR.alertSoft;

  // Calm by default: neutral slate puck. Color is reserved for state changes.
  const puckStroke = fixing ? COLOR.fixing : alert ? faultColor : COLOR.puckStroke;
  const puckFill = fixing ? COLOR.fixingSoft : alert ? faultSoft : COLOR.puck;
  const iconColor = fixing ? COLOR.fixing : alert ? faultColor : COLOR.puckInk;

  const statusText = fixing
    ? "repairing…"
    : room.kind === "lock"
      ? alert
        ? "lock · unknown"
        : "locked · armed"
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
  const statusColor = fixing ? COLOR.fixing : alert ? faultColor : COLOR.reading;

  return (
    <g>
      {/* device puck */}
      <circle cx={cx} cy={cy} r={26} fill={puckFill} stroke={puckStroke} strokeWidth={2} />
      <foreignObject x={cx - 13} y={cy - 13} width={26} height={26}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 26,
            height: 26,
            color: iconColor,
          }}
        >
          <Icon size={20} strokeWidth={1.9} />
        </div>
      </foreignObject>

      {/* healthy status dot (calm) — the ONLY green on a nominal device */}
      {!alert && !fixing && (
        <circle
          cx={cx + 21}
          cy={cy - 19}
          r={4.5}
          fill={COLOR.healthyDot}
          stroke="#0d0d14"
          strokeWidth={1.5}
          className="ward-healthy-breath"
        />
      )}

      {/* reading line: the thermostat flashes its off-target number while alert */}
      {alert && room.kind === "thermostat" ? (
        <text
          x={cx}
          y={cy + 48}
          textAnchor="middle"
          fontSize={15}
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
          y={cy + 48}
          textAnchor="middle"
          fontSize={13.5}
          fontWeight={alert || fixing ? 700 : 600}
          fill={statusColor}
          style={{ fontFamily: "var(--font-inter)" }}
        >
          {statusText}
        </text>
      )}

      {/* device label */}
      <text
        x={cx}
        y={cy + 66}
        textAnchor="middle"
        fontSize={12}
        fill={COLOR.deviceLabel}
        style={{ fontFamily: "var(--font-inter)" }}
      >
        {room.deviceLabel}
      </text>
    </g>
  );
}

// ───────────────────────────── front-door marker ───────────────────────────

function DoorMarker() {
  // The door leaf swings inward from the right jamb of the opening, with a
  // light dashed swing arc. Sits in the gap left in the top perimeter wall.
  const jambX = DOOR.x + DOOR.width; // hinge on the right jamb
  const leafEnd = polarToCartesian(jambX, DOOR.y, DOOR.width, 180); // swung 90° in
  return (
    <g pointerEvents="none">
      {/* door leaf */}
      <line
        x1={jambX}
        y1={DOOR.y}
        x2={leafEnd.x}
        y2={leafEnd.y}
        stroke={COLOR.outerWall}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      {/* swing arc */}
      <path
        d={describeArc(jambX, DOOR.y, DOOR.width, 90, 180)}
        fill="none"
        stroke={COLOR.label}
        strokeWidth={1.25}
        strokeDasharray="3 4"
      />
    </g>
  );
}

// ───────────────────────────── worker avatar layer ─────────────────────────

function WorkerLayer({
  incident,
  worker,
  onClick,
}: {
  incident: Incident;
  worker?: Worker;
  onClick: () => void;
}) {
  const { visible, point, atDevice } = avatarTarget(incident);
  const initial = incident.workerEns?.[0]?.toUpperCase() ?? "W";
  const room = incident.deviceId ? roomFor(incident.deviceId) : undefined;
  const ens = incident.workerEns ?? worker?.ensName ?? null;
  const role = worker?.skills?.[0];
  const rep = worker?.reputation;

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
          strokeLinejoin="round"
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
        <circle r={16} fill={COLOR.worker} stroke="#0a0a0f" strokeWidth={2.5} />
        <text
          textAnchor="middle"
          y={5}
          fontSize={15}
          fontWeight={700}
          fill="#0a0a0f"
          style={{ fontFamily: "var(--font-inter)" }}
        >
          {initial}
        </text>

        {/* wrench blip while fixing */}
        {atDevice && (
          <g className="ward-wrench" transform="translate(16,-16)">
            <circle r={11} fill="#111118" stroke={COLOR.fixing} strokeWidth={2} />
            <foreignObject x={-8} y={-8} width={16} height={16}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 16,
                  height: 16,
                  color: COLOR.fixing,
                }}
              >
                <Wrench size={11} strokeWidth={2.2} />
              </div>
            </foreignObject>
          </g>
        )}

        {/* ENS identity tag — this dot is a REAL, verified human the agent
            hired, not an anonymous marker. Sits just below the avatar. */}
        {ens && (
          <foreignObject x={-110} y={20} width={220} height={40}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width: 220,
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 1,
                  padding: "3px 9px",
                  borderRadius: 4,
                  background: "#111118",
                  border: `1px solid ${COLOR.puckStroke}`,
                  boxShadow: "0 2px 6px rgb(0 0 0 / 0.6)",
                  whiteSpace: "nowrap",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono-geist)",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#e2e8f0",
                    lineHeight: 1.1,
                  }}
                >
                  {ens}
                </span>
                {(role || rep != null) && (
                  <span
                    style={{
                      fontFamily: "var(--font-inter)",
                      fontSize: 10,
                      color: COLOR.healInk,
                      lineHeight: 1.1,
                    }}
                  >
                    {[role, "verified", rep != null ? `rep ${rep}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
              </div>
            </div>
          </foreignObject>
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
