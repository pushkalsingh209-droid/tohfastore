import { ImageResponse } from "next/og";
import { BrandIconMaskable } from "@/app/utils/brandMark";

// Full-bleed field, no baked-in corner rounding, glyph inset within the
// safe zone -- Android/Chrome crop this to their own icon shape.
// Request-independent output -- rendered once at build (see icon-192).
export const dynamic = "force-static";

export async function GET() {
  return new ImageResponse(<BrandIconMaskable />, { width: 512, height: 512 });
}
