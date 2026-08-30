import { ImageResponse } from "next/og";
import { BrandIcon } from "@/app/utils/brandMark";

// Request-independent output -- rendered once at build (see icon-192).
export const dynamic = "force-static";

export async function GET() {
  return new ImageResponse(<BrandIcon rounded />, { width: 512, height: 512 });
}
