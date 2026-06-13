// A small static top-down floor plan. Four rooms, four healthy device dots.
// Purely decorative: no animation, no interactivity, no real FloorPlan import.
export function FloorPlanTeaser({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 220"
      className={className}
      role="img"
      aria-label="Floor plan: four rooms, all devices healthy"
    >
      {/* outer slab */}
      <rect
        x="1"
        y="1"
        width="318"
        height="218"
        fill="#111118"
        stroke="#1e1e2e"
        strokeWidth="2"
      />

      {/* interior walls, thin #1e1e2e */}
      {/* vertical split between left rooms and right rooms */}
      <line x1="190" y1="1" x2="190" y2="219" stroke="#1e1e2e" strokeWidth="2" />
      {/* horizontal split on the left side (Living room / Hallway) */}
      <line x1="1" y1="120" x2="190" y2="120" stroke="#1e1e2e" strokeWidth="2" />
      {/* horizontal split on the right side (Entry / Laundry & bath) */}
      <line x1="190" y1="96" x2="319" y2="96" stroke="#1e1e2e" strokeWidth="2" />

      {/* room labels */}
      <text x="16" y="26" fill="#64748b" fontSize="11" fontFamily="sans-serif">
        Living room
      </text>
      <text x="16" y="146" fill="#64748b" fontSize="11" fontFamily="sans-serif">
        Hallway
      </text>
      <text x="206" y="26" fill="#64748b" fontSize="11" fontFamily="sans-serif">
        Entry
      </text>
      <text x="206" y="122" fill="#64748b" fontSize="11" fontFamily="sans-serif">
        Laundry &amp; bath
      </text>

      {/* device dots, all green / healthy */}
      <circle cx="100" cy="78" r="5" fill="#22c55e" />
      <circle cx="100" cy="178" r="5" fill="#22c55e" />
      <circle cx="256" cy="62" r="5" fill="#22c55e" />
      <circle cx="256" cy="166" r="5" fill="#22c55e" />
    </svg>
  );
}
