import { ImageResponse } from "next/og";
import { BrandIcon } from "@/app/utils/brandMark";

// Dedicated route (rather than reusing app/icon.tsx's generated URLs) so
// public/manifest's icon `src` values are stable, hand-authored paths.
// The output never varies by request -- force-static so it's rendered once
// at build and served as a plain asset, not re-rastered (satori + resvg)
// per hit. Next 15 defaults GET route handlers to dynamic; this opts back.
export const dynamic = "force-static";

export async function GET() {
  return new ImageResponse(<BrandIcon rounded />, { width: 192, height: 192 });
}
