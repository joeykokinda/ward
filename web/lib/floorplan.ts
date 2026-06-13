// Geometry + incident-phase derivation for the SVG apartment floor plan.
//
// The floor plan is a PURE PROJECTION of the WardSnapshot: room/device visual
// states and the walking-worker phase are all derived from the same incident
// state machine that drives the reasoning stream + activity feed. There is no
// second source of truth here — only layout constants and derivations.
//
// Architecturally it's drawn as ONE apartment: a thick outer wall enclosing a
// single floor slab, partitioned into rooms by SHARED hairline interior walls
// with door openings. Rooms tile the interior edge-to-edge (no floating boxes);
// a hallway corridor connects every room so the worker can walk room→room.

import type { DeviceKind, Job, PropertyStatus } from "./data/types";

// SVG canvas. Top-down apartment.
export const VIEW_W = 800;
export const VIEW_H = 560;

// The apartment's inner floor rectangle (inside the outer wall). All rooms tile
// inside this; the outer wall is stroked around it.
export const FLOOR = { x: 40, y: 40, w: 720, h: 480 } as const;
export const FLOOR_RIGHT = FLOOR.x + FLOOR.w; // 760
export const FLOOR_BOTTOM = FLOOR.y + FLOOR.h; // 520

// The front door sits on the TOP outer wall, over the Entry room. The worker
// steps through it to ENTRY (just inside), then routes through the hallway.
export const DOOR = { x: 686, y: FLOOR.y, width: 56 } as const;
export const ENTRY = { x: DOOR.x + DOOR.width / 2, y: FLOOR.y + 46 };

// A single interior wall segment (hairline). Door openings are simply gaps
// where no segment is drawn, so the rooms read as connected, not boxed.
export type WallSeg = { x1: number; y1: number; x2: number; y2: number };

// Shared interior walls with door gaps. Coordinates line up exactly with the
// room rectangles below so walls fall on shared edges, never inside a room.
// Layout: two large rooms stacked on the left (Living over Laundry/bath), a
// vertical hallway corridor down the middle, and the Entry boxed in the
// top-right. Door gaps connect every room to the hallway.
export const WALLS: WallSeg[] = [
  // Vertical spine between the left rooms and the hallway (x = 440).
  { x1: 440, y1: FLOOR.y, x2: 440, y2: 150 }, // top stub
  { x1: 440, y1: 230, x2: 440, y2: 360 }, // mid — door gap into Living @150-230
  { x1: 440, y1: 440, x2: 440, y2: FLOOR_BOTTOM }, // bottom — door gap into Laundry @360-440
  // Horizontal wall between Living room and Laundry/bath (y = 300, x 40→440).
  { x1: FLOOR.x, y1: 300, x2: 150, y2: 300 },
  { x1: 250, y1: 300, x2: 440, y2: 300 }, // door gap @150-250
  // Entry enclosure: the front-door room boxed in the top-right. South wall
  // (y = 200) and west wall (x = 590) with a door gap into the hallway.
  { x1: 590, y1: 200, x2: 690, y2: 200 }, // south wall — gap @690-760 stays open to corridor
  { x1: 590, y1: FLOOR.y, x2: 590, y2: 120 }, // west wall — door gap @120-200
];

export type Room = {
  deviceId: string;
  kind: DeviceKind;
  label: string; // room label
  deviceLabel: string; // device label under the icon
  // room rectangle (tiles the floor; corners are square — walls share edges)
  x: number;
  y: number;
  w: number;
  h: number;
  // where the room name renders (top-left inset)
  labelAt: { x: number; y: number };
  // device anchor (icon + animations center)
  device: { x: number; y: number };
  // a mid waypoint the worker walks through (hallway routing) before the device
  waypoint: { x: number; y: number };
};

// Four rooms tiling the floor: Living room (WiFi, large top-left), Hallway
// (thermostat, the central corridor that links everything), Entry (lock, the
// front-door area), Laundry/bath (leak — HERO, bottom-left).
export const ROOMS: Room[] = [
  {
    deviceId: "home-wifi",
    kind: "router",
    label: "Living room",
    deviceLabel: "WiFi router",
    x: FLOOR.x,
    y: FLOOR.y,
    w: 400,
    h: 260,
    labelAt: { x: FLOOR.x + 18, y: FLOOR.y + 30 },
    device: { x: 240, y: 165 },
    waypoint: { x: 360, y: 250 },
  },
  {
    deviceId: "home-thermostat",
    kind: "thermostat",
    label: "Hallway",
    deviceLabel: "Thermostat",
    x: 440,
    y: 200,
    w: 320,
    h: 320,
    labelAt: { x: 600, y: 230 },
    device: { x: 600, y: 380 },
    waypoint: { x: 600, y: 280 },
  },
  {
    deviceId: "home-lock",
    kind: "lock",
    label: "Entry",
    deviceLabel: "Front-door lock",
    x: 590,
    y: FLOOR.y,
    w: 170,
    h: 160,
    labelAt: { x: 608, y: FLOOR.y + 30 },
    device: { x: 675, y: 128 },
    waypoint: { x: 655, y: 175 },
  },
  {
    deviceId: "home-leak",
    kind: "leak_sensor",
    label: "Laundry / bath",
    deviceLabel: "Leak sensor",
    x: FLOOR.x,
    y: 300,
    w: 400,
    h: 220,
    labelAt: { x: FLOOR.x + 18, y: 330 },
    device: { x: 230, y: 420 },
    waypoint: { x: 360, y: 410 },
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
