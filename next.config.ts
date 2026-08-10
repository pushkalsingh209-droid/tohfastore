import type { NextConfig } from "next";

// Every external origin this site's own code actually loads a script,
// stylesheet, image, iframe, or fetch/XHR from -- Razorpay's checkout
// modal, Google Analytics/Ads (via @next/third-parties), the Google
// Translate widget (which pulls sub-resources from googleapis.com/gstatic
// beyond the translate.google.com script it directly loads), Meta Pixel,
// and Supabase Storage for every product photo. Compiled by grepping the
// codebase for every https:// reference plus each of those integrations'
// own documented CSP requirements -- getting this list wrong in the
// restrictive direction breaks real functionality (most importantly
// payment), so it's deliberately generous on the directives that are hard
// to fully enumerate (script/connect/frame) rather than maximally strict.
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net https://translate.google.com https://translate.googleapis.com https://www.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://translate.googleapis.com https://www.gstatic.com https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://gxlervcazzddqcoagewy.supabase.co https://images.unsplash.com https://www.facebook.com https://www.google-analytics.com https://www.gstatic.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com https://checkout.razorpay.com https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://connect.facebook.net https://translate.googleapis.com https://gxlervcazzddqcoagewy.supabase.co",
  "frame-src 'self' https://checkout.razorpay.com https://api.razorpay.com https://translate.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // Only enforced in production -- Next's own dev server (HMR, Turbopack's
  // eval-based fast refresh, the on-demand dev overlay) relies on patterns
  // a real CSP would legitimately want to restrict, so applying this in
  // dev would fight the tooling instead of the site's own risk surface.
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      // No camera/mic/geolocation/USB/etc. anywhere on this site.
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), usb=(), payment=(self)" },
      // Belt-and-suspenders with frame-ancestors above -- older browsers
      // that don't support CSP's frame-ancestors still get clickjacking
      // protection from this.
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
    ];
    if (process.env.NODE_ENV === "production") {
      securityHeaders.push({ key: "Content-Security-Policy", value: CSP_DIRECTIVES });
    }
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  images: {
    // Next's defaults (8 deviceSizes x 8 imageSizes) let a single product
    // photo fan out into dozens of distinct Image Optimization
    // "transformations" as different visitors' viewport widths each hit a
    // different breakpoint -- with 140+ products x multiple photos x
    // several components (card/detail/strips/wishlist/cart), that alone
    // was eating through the Vercel free tier's 5,000/month quota.
    // Trimmed to the exact widths this site's `sizes` props actually
    // resolve to: mobile-first breakpoints for the vw-relative gallery/
    // card images, plus the handful of small fixed-px thumbnails used in
    // strips, cart, wishlist, and admin.
    deviceSizes: [384, 640, 828, 1200],
    imageSizes: [48, 56, 144, 176, 180, 384],
    // TEMPORARY safety net -- already at 75% of the free tier's 5,000/month
    // Image Optimization transformations. This fully stops new
    // transformations (images serve as their original file, un-resized/
    // un-reformatted, from Supabase Storage directly) so the quota can't
    // be exceeded before it resets. Remove this line once next month's
    // quota has reset and the deviceSizes/imageSizes trim above has had a
    // chance to prove it keeps steady-state usage well under the cap.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "gxlervcazzddqcoagewy.supabase.co",
        pathname: "/storage/v1/object/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
