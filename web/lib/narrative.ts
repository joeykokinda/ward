// The story WARD tells during an incident. Two tracks: the full L3 "hire" arc
// (5 acts, ends in an on-chain settlement) and the L1 "self-fix" arc (3 acts,
// the agent fixes it in software, no human, no escrow). One source of truth for
// phase order, labels, titles, on-chain flags, shared by the mock player and the
// phase HUD.

import type { NarrativePhaseId, NarrativeTrack } from "./data/types";

export type NarrativePhaseMeta = {
  id: NarrativePhaseId;
  label: string; // short stepper chip
  title: string; // big phase title
  onChain: boolean; // escrow / settlement act
};

// L3: detect -> diagnose -> hire (escrow) -> repair -> verify (release).
export const NARRATIVE_PHASES: NarrativePhaseMeta[] = [
  { id: "detect", label: "Detect", title: "Detect the fault", onChain: false },
  { id: "diagnose", label: "Diagnose", title: "Diagnose, try the free fix", onChain: false },
  { id: "hire", label: "Hire", title: "Hire a human, on-chain", onChain: true },
  { id: "repair", label: "Repair", title: "Repair on site", onChain: false },
  { id: "verify", label: "Verify", title: "Verify the fix, release payment", onChain: true },
];

// L1: detect -> diagnose -> self-fixed. The agent reboots/reconfigures and the
// device recovers; no human, no escrow, no spend.
export const SELFFIX_PHASES: NarrativePhaseMeta[] = [
  { id: "detect", label: "Detect", title: "Detect the fault", onChain: false },
  { id: "diagnose", label: "Diagnose", title: "Diagnose, try the free fix", onChain: false },
  { id: "selffixed", label: "Self-fixed", title: "Fixed in software at L1", onChain: false },
];

export const NARRATIVE_TOTAL = NARRATIVE_PHASES.length;

export function phasesForTrack(track: NarrativeTrack): NarrativePhaseMeta[] {
  return track === "selffix" ? SELFFIX_PHASES : NARRATIVE_PHASES;
}

export function phaseMeta(track: NarrativeTrack, id: NarrativePhaseId): NarrativePhaseMeta {
  const list = phasesForTrack(track);
  return list.find((p) => p.id === id) ?? list[0];
}

// 1-based position of a phase within its track.
export function phaseIndex(track: NarrativeTrack, id: NarrativePhaseId): number {
  const list = phasesForTrack(track);
  const i = list.findIndex((p) => p.id === id);
  return (i < 0 ? 0 : i) + 1;
}
