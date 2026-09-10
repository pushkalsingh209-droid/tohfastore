// app/components/BrandSpinner.tsx
// The gift-box mark (see headerNavbar.tsx) sitting still inside a spinning
// ring, used everywhere the site shows a loading state -- replaces a plain
// unbranded spinner ring with something that's recognizably Tohfa mid-load.
export default function BrandSpinner() {
  return (
    <div className="relative w-14 h-14 mx-auto mb-4">
      <div className="absolute inset-0 rounded-full border-4 border-accent-soft-border border-t-link animate-spin motion-reduce:animate-none" aria-hidden="true" />
      <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full p-3" aria-hidden="true">
        <defs>
          {/* Hardcoded to Tailwind's amber-600/800 (light) and amber-400/600
              (dark) rather than the theme() function -- keeps this working
              regardless of Tailwind version without depending on arbitrary
              CSS function support inside an SVG <stop>. */}
          <linearGradient id="brassGradSpinner" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" className="[stop-color:var(--accent)]" />
            <stop offset="100%" className="[stop-color:var(--accent-hover)]" />
          </linearGradient>
        </defs>
        <rect x="48" y="100" width="104" height="62" rx="8" fill="url(#brassGradSpinner)" />
        <rect x="40" y="82" width="120" height="20" rx="8" fill="url(#brassGradSpinner)" opacity="0.85" />
        <rect x="93" y="82" width="14" height="80" className="fill-surface" />
        <rect x="36" y="89" width="128" height="6" className="fill-surface" />
        <path d="M 100 80 C 78 80 68 64 82 54 C 94 47 100 62 100 78 Z" fill="url(#brassGradSpinner)" />
        <path d="M 100 80 C 122 80 132 64 118 54 C 106 47 100 62 100 78 Z" fill="url(#brassGradSpinner)" />
        <rect x="93" y="73" width="14" height="13" rx="4" className="fill-surface" stroke="url(#brassGradSpinner)" strokeWidth="2.5" />
      </svg>
    </div>
  );
}
