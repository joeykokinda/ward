"use client";

import { useState } from "react";
import { formatUsdc } from "@/lib/format";
import type { AgentIdentity } from "@/lib/data/types";
import { Dot } from "./primitives";

export type Persona = "host" | "worker" | "agent";

const PERSONAS: { id: Persona; label: string; sub: string }[] = [
  { id: "host", label: "HOST", sub: "Fleet operator" },
  { id: "worker", label: "WORKER", sub: "Field tech (mobile)" },
  { id: "agent", label: "AGENT", sub: "ward-agent.eth" },
];

export function Header({
  persona,
  onPersona,
  agent,
  adapterName,
  live,
}: {
  persona: Persona;
  onPersona: (p: Persona) => void;
  agent: AgentIdentity;
  adapterName: string;
  live: boolean;
}) {
  const [open, setOpen] = useState(false);
  const current = PERSONAS.find((p) => p.id === persona)!;

  return (
    <header className="flex items-center justify-between gap-3 border-b border-border bg-panel px-4 py-2">
      {/* Left: brand + agent identity */}
      <div className="flex items-center gap-4 min-w-0">
        <div className="flex items-center gap-2">
          <span className="mono text-[15px] font-bold tracking-[0.18em] text-text">
            WARD
          </span>
          <span className="hidden sm:inline label">mission control</span>
        </div>
        <div className="hidden md:flex items-center gap-2 border-l border-border pl-4">
          <span className="label">AGENT</span>
          <span className="mono text-[13px] text-text">{agent.ensName}</span>
        </div>
      </div>

      {/* Right: LIVE, treasury, adapter, persona switcher */}
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-1.5">
          {live ? (
            <>
              <span className="dot bg-red ward-blink" aria-hidden />
              <span className="mono text-[11px] font-bold tracking-widest text-red">
                LIVE
              </span>
            </>
          ) : (
            <>
              <Dot tone="green" />
              <span className="mono text-[11px] tracking-widest text-green">IDLE</span>
            </>
          )}
        </div>

        <div className="hidden sm:flex flex-col items-end border-l border-border pl-4">
          <span className="label leading-none">TREASURY</span>
          <span className="mono text-[14px] leading-tight text-amber">
            {formatUsdc(agent.treasuryUsdc)}
            <span className="ml-1 text-[10px] text-amber/70">USDC</span>
          </span>
        </div>

        <span className="hidden lg:inline mono text-[10px] uppercase tracking-wider text-muted">
          adapter:{adapterName}
        </span>

        {/* Persona dropdown */}
        <div className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 border border-border bg-bg px-3 py-1.5 rounded-[4px] hover:border-muted"
          >
            <span className="mono text-[12px] font-semibold text-text">
              {current.label}
            </span>
            <span className="text-muted text-[10px]">{open ? "▲" : "▼"}</span>
          </button>
          {open && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setOpen(false)}
                aria-hidden
              />
              <div className="absolute right-0 z-20 mt-1 w-52 border border-border bg-panel rounded-[4px] py-1">
                {PERSONAS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      onPersona(p.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left hover:bg-bg ${
                      p.id === persona ? "bg-bg" : ""
                    }`}
                  >
                    <span>
                      <span className="mono block text-[12px] font-semibold text-text">
                        {p.label}
                      </span>
                      <span className="label">{p.sub}</span>
                    </span>
                    {p.id === persona && (
                      <span className="text-amber text-[11px]">●</span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
