// Apple's `apple-touch-startup-image` matrix: iOS Safari picks the one link
// whose `media` query matches the device's logical size, pixel ratio, and
// current orientation, and shows it as the launch screen the instant the
// PWA is opened from the home screen. There's no Next.js file convention
// for this (see app-icons.md) -- it's wired by hand into
// `metadata.appleWebApp.startupImage` in app/layout.tsx.
//
// Sizes below are logical (CSS) width/height x device pixel ratio for every
// current iPhone/iPad screen class. A device with no matching entry simply
// gets no custom splash screen (iOS falls back to a blank screen in the
// theme color) -- never a broken one, so this list only needs to be
// "as complete as practical," not exhaustive.
const DEVICE_SCREENS = [
  // iPhone
  { width: 320, height: 568, dpr: 2, label: "iPhone SE (1st gen), 5/5s/5c" },
  { width: 375, height: 667, dpr: 2, label: "iPhone 6/6s/7/8/SE (2nd/3rd gen)" },
  { width: 414, height: 736, dpr: 3, label: "iPhone 6/7/8 Plus" },
  { width: 375, height: 812, dpr: 3, label: "iPhone X/XS/11 Pro/12 mini/13 mini" },
  { width: 414, height: 896, dpr: 2, label: "iPhone XR/11" },
  { width: 414, height: 896, dpr: 3, label: "iPhone XS Max/11 Pro Max" },
  { width: 390, height: 844, dpr: 3, label: "iPhone 12/12 Pro/13/13 Pro/14" },
  { width: 428, height: 926, dpr: 3, label: "iPhone 12 Pro Max/13 Pro Max/14 Plus" },
  { width: 393, height: 852, dpr: 3, label: "iPhone 14 Pro/15/15 Pro/16" },
  { width: 430, height: 932, dpr: 3, label: "iPhone 14 Pro Max/15 Plus/15 Pro Max/16 Plus" },
  { width: 402, height: 874, dpr: 3, label: "iPhone 16 Pro" },
  { width: 440, height: 956, dpr: 3, label: "iPhone 16 Pro Max" },
  // iPad
  { width: 744, height: 1133, dpr: 2, label: 'iPad mini (8.3")' },
  { width: 768, height: 1024, dpr: 2, label: 'iPad mini/Air (9.7")' },
  { width: 810, height: 1080, dpr: 2, label: 'iPad (10.2")' },
  { width: 820, height: 1180, dpr: 2, label: 'iPad Air (10.9"/11")' },
  { width: 834, height: 1112, dpr: 2, label: 'iPad Pro (10.5")' },
  { width: 834, height: 1194, dpr: 2, label: 'iPad Pro (11")' },
  { width: 1024, height: 1366, dpr: 2, label: 'iPad Pro (12.9")' },
] as const;

export type AppleSplashLink = { url: string; media: string };

function mediaQuery(width: number, height: number, dpr: number, orientation: "portrait" | "landscape") {
  return `(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: ${orientation})`;
}

// Physical pixel size actually rendered for a given logical size/orientation.
function physicalSize(width: number, height: number, dpr: number, orientation: "portrait" | "landscape") {
  const [w, h] = orientation === "portrait" ? [width, height] : [height, width];
  return { w: w * dpr, h: h * dpr };
}

export const APPLE_SPLASH_SCREENS: AppleSplashLink[] = DEVICE_SCREENS.flatMap(({ width, height, dpr }) =>
  (["portrait", "landscape"] as const).map((orientation) => {
    const { w, h } = physicalSize(width, height, dpr, orientation);
    return {
      url: `/apple-splash/${w}x${h}`,
      media: mediaQuery(width, height, dpr, orientation),
    };
  })
);

// Every physical pixel size the /apple-splash/[size] route is allowed to
// render -- keeps that route from generating an arbitrarily large image for
// an arbitrary requested size.
export const ALLOWED_SPLASH_SIZES = new Set(APPLE_SPLASH_SCREENS.map((s) => s.url.split("/").pop()));
