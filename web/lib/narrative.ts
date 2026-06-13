// The five-act story WARD tells during an incident. One source of truth for
// the phase order, short stepper labels, big titles, and which acts are
// on-chain — shared by the mock player (which sets the live phase) and the
// NarrativeBar UI (which renders the stepper).

import type { NarrativePhaseId } from "./data/types";

export type NarrativePhaseMeta = {
  id: NarrativePhaseId;
  label: string; // short stepper chip
  title: string; // big phase title
  onChain: boolean; // escrow / settlement act
};

export const NARRATIVE_PHASES: NarrativePhaseMeta[] = [
  { id: "detect", label: "Detect", title: "Detect the fault", onChain: false },
  { id: "diagnose", label: "Diagnose", title: "Diagnose, try the free fix", onChain: false },
  { id: "hire", label: "Hire", title: "Hire a human, on-chain", onChain: true },
  { id: "repair", label: "Repair", title: "Repair on site", onChain: false },
  { id: "verify", label: "Verify", title: "Verify the fix, release payment", onChain: true },
];

export const NARRATIVE_TOTAL = NARRATIVE_PHASES.length;

export function phaseMeta(id: NarrativePhaseId): NarrativePhaseMeta {
  return NARRATIVE_PHASES.find((p) => p.id === id) ?? NARRATIVE_PHASES[0];
}

// 1-based position of a phase in the story.
export function phaseIndex(id: NarrativePhaseId): number {
  const i = NARRATIVE_PHASES.findIndex((p) => p.id === id);
  return (i < 0 ? 0 : i) + 1;
}
