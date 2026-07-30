// app/layout.tsx
import type { Metadata } from "next";
import Script from "next/script";
import { CartProvider } from "@/app/context/CartContext";
import { WishlistProvider } from "@/app/context/WishlistContext";
import CartDrawer from "@/app/components/CartDrawer";
import HeaderNavbar from "@/app/components/headerNavbar";
import CookieConsent from "@/app/components/CookieConsent";
import "./globals.css"; // Imports your global styling configurations

export const metadata: Metadata = {
  title: "Tohfa | Luxury Brass Gifts & Handicrafts",
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
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <CartProvider>
      <WishlistProvider>
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
              <p className="text-stone-600 text-[11px] uppercase tracking-wider font-light">
                &copy; {new Date().getFullYear()} Luxury Brass Gift. All Rights Reserved.
              </p>
            </div>
          </footer>

          {/* Cookie consent banner (bottom of screen, one-time until dismissed) */}
          <CookieConsent />

          {/* Dynamically loads Razorpay's secure transactional modal overlay system */}
          <Script
            src="https://checkout.razorpay.com/v1/checkout.js"
            strategy="lazyOnload"
          />
        </body>
      </WishlistProvider>
      </CartProvider>
    </html>
  );
}