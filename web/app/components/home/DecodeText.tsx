"use client";

import { useEffect, useRef, useState } from "react";

// The ONE signature: the hero H1 is not typeset, it is RECEIVED. Each glyph
// starts as a random char from a fixed amber-terminal set and resolves
// left-to-right in a short staggered wave, as if the agent is decoding its
// overnight report off the wire. A 2-3 char "decode head" of still-scrambling
// glyphs rides the boundary (rendered amber via [data-state="scrambling"]);
// locked glyphs are fg.
//
// FALLBACK: the finished `text` is the server-rendered initial state, so with
// no JS or prefers-reduced-motion it is simply the final headline, instantly,
// never blank. The scramble is the only thing the effect adds.
//
// `lines` lets the caller pass the headline as status-feed beats; the last
// line can be dimmed by the caller via `dimLastLine` (type hierarchy, not a
// new color — it reuses text-muted).

const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/\\<>*#";
const SCRAMBLE_HOLD_MS = 55; // ~3-4 frames cycling before a glyph locks
const PER_CHAR_STEP_MS = 16; // how fast the decode head advances, per glyph
const START_DELAY_MS = 120; // beat 2 of the hero boot: headline decodes after eyebrow

function randomChar() {
  return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
}

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function DecodeText({
  lines,
  dimLastLine = false,
  className = "",
}: {
  lines: string[];
  dimLastLine?: boolean;
  className?: string;
}) {
  // Flatten to a single decode sequence so the wave runs continuously across
  // line breaks, but remember where each line starts so we can re-render the
  // <br>s and dim the final line.
  const fullText = lines.join("\n");
  const total = fullText.length;

  // states[i]: 0 = not started, 1 = scrambling, 2 = locked
  const [chars, setChars] = useState<string[]>(() => fullText.split(""));
  const [states, setStates] = useState<number[]>(() =>
    fullText.split("").map(() => 2),
  );
  const [done, setDone] = useState(true);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);

  useEffect(() => {
    if (prefersReducedMotion()) return; // leave the server-rendered final text

    // Run the wave once on mount. The first tick re-seeds every glyph to its
    // scrambling state, so no setState runs synchronously in the effect body.
    let seeded = false;

    const tick = (now: number) => {
      if (startRef.current === 0) startRef.current = now + START_DELAY_MS;
      if (!seeded) {
        seeded = true;
        setDone(false);
      }
      const elapsed = now - startRef.current;

      const nextChars: string[] = new Array(total);
      const nextStates: number[] = new Array(total);
      let allLocked = true;

      for (let index = 0; index < total; index++) {
        const real = fullText[index];
        // Punctuation / spaces / newlines lock instantly to keep word shapes
        // legible mid-decode.
        if (real === " " || real === "\n" || /[.,·]/.test(real)) {
          nextChars[index] = real;
          nextStates[index] = 2;
          continue;
        }
        const charStart = index * PER_CHAR_STEP_MS;
        if (elapsed < charStart) {
          nextChars[index] = randomChar();
          nextStates[index] = 0;
          allLocked = false;
        } else if (elapsed < charStart + SCRAMBLE_HOLD_MS) {
          nextChars[index] = randomChar();
          nextStates[index] = 1; // decode head — amber
          allLocked = false;
        } else {
          nextChars[index] = real;
          nextStates[index] = 2;
        }
      }

      setChars(nextChars);
      setStates(nextStates);

      if (allLocked) {
        setDone(true);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      startRef.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullText]);

  // Render back into lines so the original <br> structure (and dimmed last
  // line) is preserved.
  const lineRanges: { text: string; states: number[]; start: number }[] = [];
  let cursor = 0;
  for (const line of lines) {
    lineRanges.push({
      text: chars.slice(cursor, cursor + line.length).join(""),
      states: states.slice(cursor, cursor + line.length),
      start: cursor,
    });
    cursor += line.length + 1; // +1 for the \n separator
  }

  return (
    <span className={className} aria-label={lines.join(" ")}>
      {lineRanges.map((lr, li) => {
        const isLast = li === lines.length - 1;
        return (
          <span
            key={li}
            className={`block ${dimLastLine && isLast ? "text-muted" : ""}`}
            aria-hidden
          >
            {lr.text.split("").map((ch, ci) => (
              <span
                key={ci}
                className="decode-glyph"
                data-state={lr.states[ci] === 1 ? "scrambling" : "locked"}
              >
                {ch}
              </span>
            ))}
            {isLast && !done ? (
              <span className="decode-cursor" aria-hidden>
                {"▋"}
              </span>
            ) : null}
            {isLast && done ? (
              <span className="decode-cursor" aria-hidden>
                {"▋"}
              </span>
            ) : null}
          </span>
        );
      })}
    </span>
  );
}
