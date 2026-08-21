// Shared brand-mark building blocks for every generated PWA image (favicon,
// apple-icon, manifest icons, apple-touch-startup-image splash screens).
// Kept as one source so the gift-box mark used in public/icon.svg and
// public/logo-mark.png stays pixel-identical everywhere it's regenerated
// via next/og's ImageResponse.
//
// Note: satori (next/og's renderer) can't resolve a fill="url(#id)"
// reference when the <linearGradient> is produced by a separate helper
// component -- it has to be inlined directly under the same <svg>, which is
// why BrandGlyph declares its own <defs> rather than sharing one.

export const BRAND_MAROON = "#3d1113";
export const BRAND_GOLD_LIGHT = "#e8c468";
export const BRAND_GOLD_DARK = "#a97d2b";

// Gift box + ribbon + a small bow on the lid -- replaces an earlier
// standalone bow glyph that, with nothing to anchor it, read as a bow tie
// rather than gift wrap.
function BrandGlyph({ gradientId }: { gradientId: string }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 200 200">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={BRAND_GOLD_LIGHT} />
          <stop offset="100%" stopColor={BRAND_GOLD_DARK} />
        </linearGradient>
      </defs>
      {/* box body */}
      <rect x="48" y="100" width="104" height="62" rx="8" fill={`url(#${gradientId})`} />
      {/* lid */}
      <rect x="40" y="82" width="120" height="20" rx="8" fill={BRAND_GOLD_DARK} />
      {/* ribbon channel, cut through lid + body */}
      <rect x="93" y="82" width="14" height="80" fill={BRAND_MAROON} />
      <rect x="36" y="89" width="128" height="6" fill={BRAND_MAROON} />
      {/* bow, sitting on the lid */}
      <path d="M 100 80 C 78 80 68 64 82 54 C 94 47 100 62 100 78 Z" fill={`url(#${gradientId})`} />
      <path d="M 100 80 C 122 80 132 64 118 54 C 106 47 100 62 100 78 Z" fill={`url(#${gradientId})`} />
      <rect x="93" y="73" width="14" height="13" rx="4" fill={BRAND_MAROON} stroke={`url(#${gradientId})`} strokeWidth="2.5" />
    </svg>
  );
}

// Full icon: brand glyph on its maroon field, filling the entire canvas --
// used for the favicon, apple-touch-icon, and the manifest's "any" icons.
export function BrandIcon({ rounded, gradientId = "g" }: { rounded: boolean; gradientId?: string }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", background: BRAND_MAROON, borderRadius: rounded ? "20%" : 0 }}>
      <BrandGlyph gradientId={gradientId} />
    </div>
  );
}

// Glyph inset within a safe zone, on a full-bleed square field -- for the
// manifest's "maskable" icon, which the OS crops to its own shape (circle,
// squircle, ...) so nothing important can live near the edges.
export function BrandIconMaskable({ gradientId = "gm" }: { gradientId?: string }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", background: BRAND_MAROON }}>
      <div style={{ width: "100%", height: "100%", display: "flex", padding: "18%" }}>
        <BrandGlyph gradientId={gradientId} />
      </div>
    </div>
  );
}

// Launch/splash screen: brand glyph centered on the maroon field with the
// wordmark beneath it, sized proportionally so it scales across every
// device canvas passed in.
export function BrandSplash({ width, height, gradientId = "gs" }: { width: number; height: number; gradientId?: string }) {
  const glyphSize = Math.round(Math.min(width, height) * 0.22);
  const fontSize = Math.round(Math.min(width, height) * 0.052);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: BRAND_MAROON,
      }}
    >
      <div style={{ width: glyphSize, height: glyphSize, display: "flex" }}>
        <BrandGlyph gradientId={gradientId} />
      </div>
      <div
        style={{
          marginTop: Math.round(glyphSize * 0.32),
          fontSize,
          fontWeight: 700,
          letterSpacing: Math.round(fontSize * 0.35),
          color: BRAND_GOLD_LIGHT,
        }}
      >
        TOHFA
      </div>
    </div>
  );
}
