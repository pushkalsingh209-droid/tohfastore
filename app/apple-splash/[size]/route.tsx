import { NextResponse } from "next/server";
import { ImageResponse } from "next/og";
import { BrandSplash } from "@/app/utils/brandMark";
import { ALLOWED_SPLASH_SIZES } from "@/app/utils/appleSplashScreens";

// Only ever called with one of the exact "WxH" strings this app itself
// generated into metadata.appleWebApp.startupImage (see app/layout.tsx) --
// rejecting anything else keeps this route from rendering an arbitrarily
// large image for an arbitrary requested size.
export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  if (!ALLOWED_SPLASH_SIZES.has(size)) {
    return NextResponse.json({ error: "Unknown splash size" }, { status: 404 });
  }

  const [width, height] = size.split("x").map(Number);
  return new ImageResponse(<BrandSplash width={width} height={height} />, { width, height });
}
