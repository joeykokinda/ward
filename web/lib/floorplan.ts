// Geometry + incident-phase derivation for the SVG apartment floor plan.
//
// The floor plan is a PURE PROJECTION of the WardSnapshot: room/device visual
// states and the walking-worker phase are all derived from the same incident
// state machine that drives the reasoning stream + activity feed. There is no
// second source of truth here — only layout constants and derivations.

import type { DeviceKind, Job, PropertyStatus } from "./data/types";

// SVG canvas. Top-down apartment.
export const VIEW_W = 800;
export const VIEW_H = 560;

// Where the worker enters the apartment (front-door edge, top-right).
export const ENTRY = { x: 690, y: 70 };

export type Room = {
  deviceId: string;
  kind: DeviceKind;
  label: string; // room label
  deviceLabel: string; // device label under the icon
  // room rectangle
  x: number;
  y: number;
  w: number;
  h: number;
  // device anchor (icon + animations center)
  device: { x: number; y: number };
  // a mid waypoint the worker walks through (hallway routing) before the device
  waypoint: { x: number; y: number };
};

// Four rooms. Living room (WiFi), hallway/center (thermostat), front-door area
// (lock), laundry/bathroom (leak — HERO). Coordinates chosen so walls share
// edges and the hallway connects everything.
export const ROOMS: Room[] = [
  {
    deviceId: "home-wifi",
    kind: "router",
    label: "Living room",
    deviceLabel: "WiFi router",
    x: 40,
    y: 40,
    w: 340,
    h: 280,
    device: { x: 130, y: 120 },
    waypoint: { x: 300, y: 300 },
  },
  {
    deviceId: "home-thermostat",
    kind: "thermostat",
    label: "Hallway",
    deviceLabel: "Thermostat",
    x: 380,
    y: 220,
    w: 200,
    h: 300,
    device: { x: 480, y: 300 },
    waypoint: { x: 480, y: 360 },
  },
  {
    deviceId: "home-lock",
    kind: "lock",
    label: "Entry",
    deviceLabel: "Front-door lock",
    x: 580,
    y: 40,
    w: 180,
    h: 180,
    device: { x: 670, y: 120 },
    waypoint: { x: 640, y: 200 },
  },
  {
    deviceId: "home-leak",
    kind: "leak_sensor",
    label: "Laundry / bath",
    deviceLabel: "Leak sensor",
    x: 40,
    y: 320,
    w: 340,
    h: 200,
    device: { x: 150, y: 430 },
    waypoint: { x: 300, y: 430 },
  },
];

export function roomFor(deviceId: string): Room | undefined {
  return ROOMS.find((r) => r.deviceId === deviceId);
}

// Visual state of a single device on the plan.
export type DeviceVisual = "healthy" | "alert" | "being_fixed";

export function deviceVisual(
  p: PropertyStatus,
  beingFixed: boolean,
): DeviceVisual {
  if (beingFixed) return "being_fixed";
  if (!p.device.online || p.device.faultMode !== "none") return "alert";
  return "healthy";
}

// Where the worker avatar is in the dispatch animation. Derived from the active
// job + the target device's telemetry so the avatar, the reasoning stream, and
// the activity feed all stay in lockstep.
export type WalkPhase =
  | "idle" // no worker on the plan
  | "dispatched" // escrow funded, worker selected, not yet walking
  | "enroute" // claimed (txAccept) -> walking from entry to the device
  | "fixing" // fix submitted -> at the device, wrench shows
  | "exit"; // device healed -> walking back to the entry, then gone

export type Incident = {
  job: Job | null;
  deviceId: string | null; // device the active job targets
  phase: WalkPhase;
  workerEns: string | null;
};

// Project the snapshot's active job into a walk phase. The mock state machine
// moves Funded -> (txAccept) -> Submitted -> Completed; we read those plus the
// device's recovered telemetry to decide where the avatar should be.
export function deriveIncident(
  job: Job | null,
  properties: PropertyStatus[],
): Incident {
  if (!job) return { job: null, deviceId: null, phase: "idle", workerEns: null };

  const target = properties.find((p) => p.id === job.deviceId);
  const recovered = target ? target.device.faultMode === "none" && target.device.online : false;

  let phase: WalkPhase;
  if (job.state === "Submitted") {
    // fix submitted; if telemetry already recovered, the worker is finishing up
    phase = "fixing";
  } else if (job.state === "Funded" && job.txAccept) {
    phase = "enroute";
  } else if (job.state === "Funded") {
    phase = "dispatched";
  } else {
    phase = recovered ? "exit" : "idle";
  }

  return {
    job,
    deviceId: job.deviceId,
    phase,
    workerEns: job.worker,
  };
}

// Is the worker currently AT this device (so the device shows the being-fixed
// treatment instead of the alert animation)?
export function isBeingFixed(incident: Incident, deviceId: string): boolean {
  return incident.deviceId === deviceId && incident.phase === "fixing";
}

// The avatar's current target point for the given phase. CSS transitions the
// <g> between these, giving a smooth ~walk.
export function avatarTarget(incident: Incident): {
  visible: boolean;
  point: { x: number; y: number };
  atDevice: boolean;
} {
  const room = incident.deviceId ? roomFor(incident.deviceId) : undefined;
  switch (incident.phase) {
    case "dispatched":
      // appears at the entry edge, waiting
      return { visible: true, point: ENTRY, atDevice: false };
    case "enroute":
    case "fixing":
      // walking to / standing at the device
      return {
        visible: true,
        point: room ? room.device : ENTRY,
        atDevice: incident.phase === "fixing",
      };
    case "exit":
      // walk back to the entry, then disappear (the component fades it out)
      return { visible: true, point: ENTRY, atDevice: false };
    default:
      return { visible: false, point: ENTRY, atDevice: false };
  }
}

// Dashed path the worker follows: entry -> room waypoint -> device. Returned as
// an SVG path `d`. Drawn only while a worker is on the plan.
export function workerPathD(deviceId: string): string {
  const room = roomFor(deviceId);
  if (!room) return "";
  const wp = room.waypoint;
  const d = room.device;
  return `M ${ENTRY.x} ${ENTRY.y} L ${wp.x} ${wp.y} L ${d.x} ${d.y}`;
}
