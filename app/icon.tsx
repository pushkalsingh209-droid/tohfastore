import { ImageResponse } from "next/og";
import { BrandIcon } from "@/app/utils/brandMark";

export const contentType = "image/png";

export function generateImageMetadata() {
  return [
    { id: "tab", size: { width: 32, height: 32 } },
    { id: "hires", size: { width: 192, height: 192 } },
  ];
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const size = (await id) === "hires" ? 192 : 32;
  return new ImageResponse(<BrandIcon rounded />, { width: size, height: size });
}
