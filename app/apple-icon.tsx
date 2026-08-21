import { ImageResponse } from "next/og";
import { BrandIcon } from "@/app/utils/brandMark";

// 180x180 is Apple's current recommended apple-touch-icon size. No rounded
// corners here on purpose -- iOS applies its own squircle mask on top, so a
// pre-rounded source just double-rounds the corners.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<BrandIcon rounded={false} />, size);
}
