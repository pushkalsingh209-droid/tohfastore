// app/layout.tsx
import type { Metadata } from "next";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { GoogleAnalytics } from "@next/third-parties/google";
import { CartProvider } from "@/app/context/CartContext";
import { WishlistProvider } from "@/app/context/WishlistContext";
import { CatalogLoadingProvider } from "@/app/context/CatalogLoadingContext";
import { CategoryDiscountProvider } from "@/app/context/CategoryDiscountContext";
import { PhotoFilterSettingProvider } from "@/app/context/PhotoFilterSettingContext";
import { LabelPhotoFilterProvider } from "@/app/context/LabelPhotoFilterContext";
import { ProductUnitSettingProvider } from "@/app/context/ProductUnitSettingContext";
import { DefaultWhatsappNumberProvider } from "@/app/context/DefaultWhatsappNumberContext";
import CartDrawer from "@/app/components/CartDrawer";
import HeaderNavbar from "@/app/components/headerNavbar";
import CatalogLoadingOverlay from "@/app/components/CatalogLoadingOverlay";
import FloatingContactButtons from "@/app/components/FloatingContactButtons";
import DeferredWidgets from "@/app/components/DeferredWidgets";
import ResourceHints from "@/app/components/ResourceHints";
import MetaPixel from "@/app/components/MetaPixel";
import "./globals.css"; // Imports your global styling configurations

export const metadata: Metadata = {
  metadataBase: new URL("https://tohfaonline.com"),
  title: "Tohfa | Luxury Gift Paradise & Handicrafts",
  description: "Exquisite handcrafted brass decor, vintage utensils, and premium corporate gifting items.",
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

// Runs before paint so the page never flashes the wrong theme: reads a
// saved preference, or falls back to the OS-level preference on first
// visit. Kept as a plain inline script (not a component) so it executes
// synchronously in <head>, ahead of any client-side hydration.
const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('theme');
    var isDark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (isDark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <ResourceHints />
      </head>
      <CartProvider>
      <WishlistProvider>
      <CatalogLoadingProvider>
      <CategoryDiscountProvider>
      <PhotoFilterSettingProvider>
      <LabelPhotoFilterProvider>
      <ProductUnitSettingProvider>
      <DefaultWhatsappNumberProvider>
        <body className="bg-[var(--background)] dark:bg-stone-950 text-stone-800 dark:text-stone-200 antialiased min-h-screen flex flex-col transition-colors">

          {/* Skip link for keyboard/screen-reader users -- visually hidden
              until focused, jumps straight past the nav to page content. */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-amber-700 focus:text-white focus:px-4 focus:py-2 focus:rounded focus:shadow-lg focus:text-sm focus:font-semibold"
          >
            Skip to main content
          </a>

          {/* Universal Premium Branding Banner & Navigation */}
          <HeaderNavbar />

          {/* Main Context Grid Pages (Storefront, Secure Admin Panel, and Checkout Success) */}
          <main id="main-content" className="flex-grow">{children}</main>

          {/* Persistent Sliding Shopping Drawer Overlay Panel */}
          <CartDrawer />

          {/* Storefront Global Structural Footer */}
          <footer className="bg-stone-900 dark:bg-black text-stone-400 py-12 border-t-4 border-amber-600">
            <div className="max-w-7xl mx-auto px-6 text-center text-sm">
              <p className="font-serif text-amber-500 text-lg mb-2 tracking-wider">Tohfa Premium Handicrafts</p>
              <p className="text-stone-500 text-xs font-light max-w-md mx-auto mb-4">
                Supplying premium lightweight brassware statement designs, artifact boxes, and corporate luxury gifting models globally.
              </p>

              {/* Social links -- site-wide since this footer lives in the
                  root layout, so every page gets these. */}
              <div className="flex items-center justify-center gap-4 mb-5">
                <a
                  href="https://www.instagram.com/tohfaforu/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="TOHFA on Instagram"
                  className="w-9 h-9 rounded-full border border-stone-700 hover:border-amber-500 text-stone-400 hover:text-amber-500 flex items-center justify-center transition"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zM12 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
                  </svg>
                </a>
                <a
                  href="https://www.facebook.com/profile.php?id=61574670900294"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="TOHFA on Facebook"
                  className="w-9 h-9 rounded-full border border-stone-700 hover:border-amber-500 text-stone-400 hover:text-amber-500 flex items-center justify-center transition"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M22 12.06C22 6.505 17.523 2 12 2S2 6.505 2 12.06C2 17.08 5.657 21.24 10.438 22v-7.03H7.898v-2.91h2.54V9.845c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562v1.878h2.773l-.443 2.91h-2.33V22C18.343 21.24 22 17.08 22 12.06z" />
                  </svg>
                </a>
              </div>

              <p className="text-stone-600 text-[11px] uppercase tracking-wider font-light">
                &copy; {new Date().getFullYear()} Luxury Gift Paradise. All Rights Reserved.
              </p>
            </div>
          </footer>

          {/* Shared loading overlay for pagination, filters, and the header's
              category menu -- one implementation, triggered from anywhere. */}
          <CatalogLoadingOverlay />

          {/* Mobile-only floating WhatsApp/email shortcut -- the header's
              contact row is desktop-only, so this keeps "chat with us" one
              tap away on the screens where it matters most. Rendered
              directly (not in DeferredWidgets below): it's a plain server
              component with no client JS of its own, so there's nothing to
              defer -- wrapping it in next/dynamic would only add one. */}
          <FloatingContactButtons />

          {/* Cookie consent banner, install prompt, abandoned-cart nudge,
              and the welcome Ganesha popup -- none of these act before a
              delay, a browser event, or a client-only check, so none need
              to be in the page's initial JS bundle. See
              app/components/DeferredWidgets.tsx. */}
          <DeferredWidgets />

          {/* Dynamically loads Razorpay's secure transactional modal overlay system */}
          <Script
            src="https://checkout.razorpay.com/v1/checkout.js"
            strategy="lazyOnload"
          />

          {/* GA4 -- feeds the Google Ads campaign currently running for
              tohfaonline.com. Purchase conversions are fired separately on
              the success page using the real order amount (see
              app/success/page.tsx), not just this page-view tag. This also
              loads gtag.js and sets up window.gtag, which the Ads config
              below reuses instead of loading a second copy of the script. */}
          <GoogleAnalytics gaId="G-VQNDNFET4F" />
          {/* Google Ads conversion tag (AW-16996304509), provided directly by
              the user for the live ad campaign. Reuses the dataLayer/gtag
              already set up above rather than re-loading gtag.js. */}
          <Script id="google-ads-config" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('config', 'AW-16996304509');`}
          </Script>
          {/* Meta (Facebook/Instagram) Pixel -- no-ops until
              NEXT_PUBLIC_META_PIXEL_ID is set. */}
          <MetaPixel />

          {/* Free on the current Vercel plan -- gives real traffic/perf data
              instead of guesswork for what to optimize next. */}
          <Analytics />
          {/* Real-user Core Web Vitals (LCP, CLS, INP, etc.) per page,
              visible in the Vercel dashboard's Speed Insights tab --
              same free tier as Analytics above, just a separate script. */}
          <SpeedInsights />
        </body>
      </DefaultWhatsappNumberProvider>
      </ProductUnitSettingProvider>
      </LabelPhotoFilterProvider>
      </PhotoFilterSettingProvider>
      </CategoryDiscountProvider>
      </CatalogLoadingProvider>
      </WishlistProvider>
      </CartProvider>
    </html>
  );
}