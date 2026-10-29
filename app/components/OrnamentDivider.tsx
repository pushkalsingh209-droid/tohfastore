// app/components/OrnamentDivider.tsx
// A hairline rule with a small lotus at its centre -- the same lotus/peacock
// iconography as TempleCardFrame, used to separate homepage sections so the
// page reads as sections of one craft story rather than stacked bands.
// Pure inline SVG (no request); colour follows the active theme's accent via
// currentColor, and the flanking lines are drawn by .ornament-divider in
// globals.css. Decorative, so hidden from assistive tech.
export default function OrnamentDivider() {
  return (
    <div className="ornament-divider" aria-hidden="true" role="presentation">
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 5c2.2 2.4 3.3 5 3.3 7.6 0 2.1-1.2 3.9-3.3 5.2-2.1-1.3-3.3-3.1-3.3-5.2C10.7 10 11.8 7.4 14 5z" />
        <path d="M14 18c-3.9-.4-7-2.7-8.6-6.3 2.9-.2 5.3.6 7 2.2" />
        <path d="M14 18c3.9-.4 7-2.7 8.6-6.3-2.9-.2-5.3.6-7 2.2" />
        <path d="M9 21.5h10" />
        <circle cx="14" cy="12.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    </div>
  );
}
