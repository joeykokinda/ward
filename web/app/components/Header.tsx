"use client";

import { useState } from "react";
import { Building2, ChevronDown, Cpu, ShieldCheck, Wrench } from "lucide-react";
import { formatUsdc } from "@/lib/format";
import type { AgentIdentity } from "@/lib/data/types";

export type Persona = "host" | "worker" | "agent";

const PERSONAS: {
  id: Persona;
  label: string;
  sub: string;
  Icon: typeof Building2;
}[] = [
  { id: "host", label: "Host", sub: "Fleet operator", Icon: Building2 },
  { id: "worker", label: "Worker", sub: "Field technician", Icon: Wrench },
  { id: "agent", label: "Agent", sub: "ward-agent.eth", Icon: Cpu },
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
    <header className="flex items-center justify-between gap-3 border-b border-border bg-surface px-5 py-3">
      {/* Left: brand + agent identity */}
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent">
            <ShieldCheck className="h-4 w-4 text-white" strokeWidth={2.4} />
          </span>
          <span className="text-[16px] font-semibold tracking-tight text-fg">WARD</span>
        </div>
        <div className="hidden items-center gap-2 border-l border-border pl-4 md:flex">
          <span className="text-[12px] text-muted">Agent</span>
          <span className="mono text-[13px] font-medium text-fg-soft">
            {agent.ensName}
          </span>
        </div>
      </div>

      {/* Right: status, treasury, adapter, persona switcher */}
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2">
          <span
            className={`dot ${live ? "bg-accent ward-live-dot" : "bg-faint"}`}
            aria-hidden
          />
          <span
            className={`text-[12px] font-medium ${live ? "text-accent-ink" : "text-muted"}`}
          >
            {live ? "Live" : "Idle"}
          </span>
        </div>

        <div className="hidden flex-col items-end border-l border-border pl-4 sm:flex">
          <span className="text-[11px] text-muted leading-none">Treasury</span>
          <span className="mono text-[14px] font-semibold leading-tight text-fg">
            {formatUsdc(agent.treasuryUsdc)}
            <span className="ml-1 font-sans text-[10px] font-medium text-muted">
              USDC
            </span>
          </span>
        </div>

        <span className="hidden text-[11px] text-faint lg:inline">
          {adapterName}
        </span>

        {/* Persona dropdown */}
        <div className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 transition-colors hover:border-border-strong hover:bg-subtle"
          >
            <current.Icon className="h-4 w-4 text-muted" strokeWidth={2} />
            <span className="text-[13px] font-medium text-fg">{current.label}</span>
            <ChevronDown
              className={`h-4 w-4 text-faint transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
          {open && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setOpen(false)}
                aria-hidden
              />
              <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-surface p-1.5 card-shadow-lg">
                {PERSONAS.map((p) => {
                  const active = p.id === persona;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        onPersona(p.id);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
                        active ? "bg-accent-soft" : "hover:bg-subtle"
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                          active ? "bg-accent text-white" : "bg-subtle text-muted"
                        }`}
                      >
                        <p.Icon className="h-4 w-4" strokeWidth={2} />
                      </span>
                      <span className="min-w-0">
                        <span
                          className={`block text-[13px] font-semibold ${
                            active ? "text-accent-ink" : "text-fg"
                          }`}
                        >
                          {p.label}
                        </span>
                        <span className="block truncate text-[11px] text-muted">
                          {p.sub}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
