// Single env-switched entry point for the data layer.
// NEXT_PUBLIC_DATA_ADAPTER = "mock" (default) | "supabase".
//
// One adapter instance is shared across the app (module singleton) so every
// persona reads the same live state and the incident player drives them all.

import { DATA_ADAPTER } from "../config";
import { createMockAdapter } from "./mock";
import { createSupabaseAdapter } from "./supabase";
import type { WardAdapter } from "./types";

let singleton: WardAdapter | null = null;

export function getAdapter(): WardAdapter {
  if (singleton) return singleton;
  singleton =
    DATA_ADAPTER === "supabase" ? createSupabaseAdapter() : createMockAdapter();
  return singleton;
}

export * from "./types";
