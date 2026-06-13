// Deterministic worker address derivation for the synthetic demo fleet.
//
// mike.ward-agent.eth maps to the REAL Arc worker (a fixed address passed in by
// the operator). sara/deon/lena/raj are synthetic fleet members whose owner
// addresses are derived from a well-known THROWAWAY test mnemonic (the standard
// Hardhat/anvil "test ... junk" phrase). These keys are public and hold no
// funds; they exist only to give each subname a distinct, reproducible owner.

import { mnemonicToAccount } from "viem/accounts";
import type { Address } from "viem";

export const DEMO_MNEMONIC =
  "test test test test test test test test test test test junk";

// Synthetic fleet handles in derivation order (addressIndex 1..N; index 0 is
// reserved so none of these collide with the canonical anvil[0] account).
export const SYNTHETIC_HANDLES = ["sara", "deon", "lena", "raj"] as const;

export function deriveWorkerAddress(addressIndex: number): Address {
  return mnemonicToAccount(DEMO_MNEMONIC, { addressIndex }).address;
}

export function syntheticFleet(): Record<string, Address> {
  const out: Record<string, Address> = {};
  SYNTHETIC_HANDLES.forEach((handle, i) => {
    out[handle] = deriveWorkerAddress(i + 1);
  });
  return out;
}
