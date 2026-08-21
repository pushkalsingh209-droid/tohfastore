import { ImageResponse } from "next/og";
import { BrandIcon } from "@/app/utils/brandMark";

// Dedicated route (rather than reusing app/icon.tsx's generated URLs) so
// public/manifest's icon `src` values are stable, hand-authored paths.
export async function GET() {
  return new ImageResponse(<BrandIcon rounded />, { width: 192, height: 192 });
}
