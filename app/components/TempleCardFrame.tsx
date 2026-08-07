// app/components/TempleCardFrame.tsx
"use client";

// Subtle, low-contrast tones — the frame should read as a faint, elegant
// accent rather than a bold border.
const GOLD = "#cbb673";
const MAROON = "#b08a8a";
const CREAM = "#fdf6e9";

// Repeating engraved trim alternating a lotus and a peacock-feather motif —
// both are classical Hindu iconographic attributes (lotus/Lakshmi, peacock
// feather/Krishna) rather than a literal repeated deity figure, which reads
// as tasteful ornamental engraving rather than a reductive religious pattern.
// Fixed real-pixel tile, no viewBox — never distorts regardless of card width.
function EngravedTrimStrip({ height, patternId }: { height: number; patternId: string }) {
  const tileW = height * 2.4;
  const r = height * 0.11;
  return (
    <svg width="100%" height={height} className="block">
      <defs>
        <pattern id={patternId} patternUnits="userSpaceOnUse" width={tileW} height={height}>
          <rect width={tileW} height={height} fill={CREAM} />

          {/* Lotus */}
          <g transform={`translate(${tileW * 0.27}, ${height * 0.52})`}>
            {[0, 60, 120, 180, 240, 300].map((a) => (
              <ellipse
                key={a}
                cx="0"
                cy={-height * 0.26}
                rx={r}
                ry={height * 0.22}
                transform={`rotate(${a})`}
                fill={GOLD}
                stroke={MAROON}
                strokeWidth="0.5"
              />
            ))}
            <circle r={r * 0.9} fill={MAROON} />
          </g>

          {/* Peacock feather */}
          <g transform={`translate(${tileW * 0.73}, ${height * 0.52})`}>
            <ellipse cx="0" cy="0" rx={height * 0.15} ry={height * 0.34} fill={GOLD} stroke={MAROON} strokeWidth="0.5" />
            <circle cx="0" cy={-height * 0.08} r={height * 0.1} fill={MAROON} />
            <circle cx="0" cy={-height * 0.08} r={height * 0.045} fill={GOLD} />
          </g>

          <rect x="0" y={height - 1.4} width={tileW} height="1.4" fill={MAROON} />
        </pattern>
      </defs>
      <rect width="100%" height={height} fill={`url(#${patternId})`} />
    </svg>
  );
}

// Slim carved-pillar side strip (bead/ring repeat). Fixed real-pixel width,
// fluid height — card height varies (gallery/description), so only this
// axis needs to tile arbitrarily.
function SideBeadStrip({ width, patternId }: { width: number; patternId: string }) {
  const tileH = width * 2.6;
  return (
    <svg width={width} height="100%" className="block h-full">
      <defs>
        <pattern id={patternId} patternUnits="userSpaceOnUse" width={width} height={tileH}>
          <rect width={width} height={tileH} fill={CREAM} />
          <rect x={width / 2 - 0.75} y="0" width="1.5" height={tileH} fill={GOLD} />
          <circle cx={width / 2} cy={tileH * 0.5} r={width * 0.3} fill={CREAM} stroke={GOLD} strokeWidth="1" />
          <circle cx={width / 2} cy={tileH * 0.5} r={width * 0.13} fill={MAROON} />
        </pattern>
      </defs>
      <rect width={width} height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}

function LotusCornerMedallion({ size = 20, className = "" }: { size?: number; className?: string }) {
  const angles = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className}>
      <g stroke={GOLD} strokeWidth="1" fill={CREAM}>
        {angles.map((angle) => (
          <ellipse key={angle} cx="20" cy="10" rx="4.2" ry="9" transform={`rotate(${angle} 20 20)`} />
        ))}
      </g>
      <circle cx="20" cy="20" r="4" fill={MAROON} stroke={GOLD} strokeWidth="1" />
    </svg>
  );
}

export default function TempleCardFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative rounded-lg overflow-hidden catalog-card-cv"
      style={{ boxShadow: `0 0 0 1px ${GOLD}` }}
    >
      <EngravedTrimStrip height={6} patternId="card-trim-top" />

      <div className="flex items-stretch">
        <div className="w-1 flex-shrink-0">
          <SideBeadStrip width={4} patternId="card-side-left" />
        </div>
        <div className="flex-1 min-w-0">{children}</div>
        <div className="w-1 flex-shrink-0">
          <SideBeadStrip width={4} patternId="card-side-right" />
        </div>
      </div>

      <EngravedTrimStrip height={6} patternId="card-trim-bottom" />

      <LotusCornerMedallion size={10} className="absolute top-0 left-0 z-10 pointer-events-none" />
      <LotusCornerMedallion size={10} className="absolute top-0 right-0 z-10 pointer-events-none scale-x-[-1]" />
      <LotusCornerMedallion size={10} className="absolute bottom-0 left-0 z-10 pointer-events-none scale-y-[-1]" />
      <LotusCornerMedallion size={10} className="absolute bottom-0 right-0 z-10 pointer-events-none scale-x-[-1] scale-y-[-1]" />
    </div>
  );
}
