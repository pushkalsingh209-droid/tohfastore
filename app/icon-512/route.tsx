import { ImageResponse } from "next/og";
import { BrandIcon } from "@/app/utils/brandMark";

export async function GET() {
  return new ImageResponse(<BrandIcon rounded />, { width: 512, height: 512 });
}
