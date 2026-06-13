"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

// Light, calm modal: soft white card, gentle pop-in, click-outside + Esc to
// close. No dark overlay glow — a quiet slate scrim.
export function Modal({
  open,
  onClose,
  children,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  labelledBy?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="ward-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgb(15 23 42 / 0.28)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <div
        className="ward-modal relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface card-shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-subtle hover:text-fg"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
        {children}
      </div>
    </div>
  );
}
