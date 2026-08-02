import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
