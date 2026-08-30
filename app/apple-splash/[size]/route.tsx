import { NextResponse } from "next/server";
import { ImageResponse } from "next/og";
import { BrandSplash } from "@/app/utils/brandMark";
import { ALLOWED_SPLASH_SIZES } from "@/app/utils/appleSplashScreens";

// Every allowed "WxH" produces a fixed, request-independent image, so
// prerender the whole set at build and force-static the route -- otherwise
// each device's first launch re-rastered its splash (satori + resvg) as a
// dynamic function call. dynamicParams stays default: an unknown size still
// hits GET and 404s via the ALLOWED check below.
export const dynamic = "force-static";

export function generateStaticParams() {
  return Array.from(ALLOWED_SPLASH_SIZES)
    .filter((size): size is string => Boolean(size))
    .map((size) => ({ size }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  if (!ALLOWED_SPLASH_SIZES.has(size)) {
    return NextResponse.json({ error: "Unknown splash size" }, { status: 404 });
  }

  const [width, height] = size.split("x").map(Number);
  return new ImageResponse(<BrandSplash width={width} height={height} />, { width, height });
}
