"use client";

import { useEffect, useState } from "react";

// Live ENS resolution hook — fetches /api/ens/<name> (server resolves on Sepolia)
// and exposes the result for the modals. Returns the `live:false` shape on any
// error or while loading, so callers fall back to their labeled fixture records
// and the UI never blocks on a slow RPC.

export type EnsLiveRecords = {
  skills: string[];
  region: string;
  reputationPointer: string;
  role: string;
  agentContext: string;
  webEndpoint: string;
  a2aEndpoint: string;
  mcpEndpoint: string;
};

export type EnsLiveData =
  | {
      live: true;
      name: string;
      chain: "sepolia";
      address: string | null;
      records: EnsLiveRecords;
      ensip25Verified: boolean;
      ensip25Key: string;
      resolvedAtIso: string;
    }
  | { live: false; name?: string };

export type EnsLiveState = {
  data: EnsLiveData;
  loading: boolean;
};

// Fetch live ENS data for a name. `enabled=false` (e.g. modal closed) skips the
// network call. Re-fetches when the name changes or the modal opens. All state
// transitions happen inside async callbacks so the effect never sets state
// synchronously (keeps cascading renders out, satisfies react-hooks lint).
export function useEnsLive(name: string | undefined, enabled = true): EnsLiveState {
  const active = enabled && !!name;
  const [state, setState] = useState<EnsLiveState>(() => ({
    data: { live: false, name },
    loading: active,
  }));

  useEffect(() => {
    // Per-run guard: only the latest effect invocation may write state. All
    // writes happen inside async callbacks so the effect never sets state
    // synchronously (keeps cascading renders out).
    let cancelled = false;
    const settle = (next: EnsLiveState) => {
      if (!cancelled) setState(next);
    };

    if (!active) {
      Promise.resolve().then(() => settle({ data: { live: false, name }, loading: false }));
      return () => {
        cancelled = true;
      };
    }

    Promise.resolve().then(() => settle({ data: { live: false, name }, loading: true }));

    fetch(`/api/ens/${encodeURIComponent(name!)}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((json: EnsLiveData) => settle({ data: json ?? { live: false, name }, loading: false }))
      .catch(() => settle({ data: { live: false, name }, loading: false }));

    return () => {
      cancelled = true;
    };
  }, [name, active]);

  return state;
}
