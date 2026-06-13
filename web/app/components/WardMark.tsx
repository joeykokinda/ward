/**
 * WARD brandmark — a shield silhouette with the "W" initial notched through
 * the metal. The shield is white; the W is cut to the accent so, sitting on
 * the lime brand square, it reads as engraved. One flat accent, no gradient.
 */
export function WardMark({
  className = "h-[18px] w-[18px]",
}: {
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      {/* shield */}
      <path
        d="M12 2.6 L19.4 5.2 V11.4 C19.4 16.1 16.2 19.7 12 21.4 C7.8 19.7 4.6 16.1 4.6 11.4 V5.2 Z"
        className="fill-white"
      />
      {/* W initial, notched into the shield */}
      <path
        d="M7.4 8.7 L9.85 14.5 L12 10.7 L14.15 14.5 L16.6 8.7"
        fill="none"
        className="stroke-accent"
        strokeWidth="2.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
