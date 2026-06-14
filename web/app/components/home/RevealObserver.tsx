"use client";

import { useEffect } from "react";

// Adds `.is-visible` to every `.reveal` / `.reveal-stagger` block the moment it
// scrolls into view, driving the CSS fade+rise transitions. Uses Intersection
// Observer so it fires in every browser (the old CSS view() timeline only ran
// in Chromium). If IntersectionObserver is missing, everything is revealed
// immediately so content is never stuck hidden. Renders nothing.
export function RevealObserver() {
  useEffect(() => {
    const els = Array.from(
      document.querySelectorAll<HTMLElement>(".reveal, .reveal-stagger"),
    );
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return null;
}
