"""WARD autonomous agent runtime.

The brain of WARD: polls a device fleet, diagnoses faults with an LLM,
attempts a remote software fix (Level 1), and when that fails escrows USDC
and dispatches a human worker (Level 3), then triggers the CRE attestation
and confirms settlement.

Runs fully offline with graceful fallbacks; real keys plug in via env.
"""

__version__ = "0.1.0"
