// app/layout.tsx
import type { Metadata } from "next";
import Script from "next/script";
import { CartProvider } from "@/app/context/CartContext";
import CartDrawer from "@/app/components/CartDrawer";
import HeaderNavbar from "@/app/components/headerNavbar";
import "./globals.css"; // Imports your global styling configurations

export const metadata: Metadata = {
  title: "Tohfa | Luxury Brass Gifts & Handicrafts",
  description: "Exquisite handcrafted brass decor, vintage utensils, and premium corporate gifting items.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <CartProvider>
        <body className="bg-[#FAF9F6] text-stone-800 antialiased min-h-screen flex flex-col">
          
          {/* Universal Premium Branding Banner & Navigation */}
          <HeaderNavbar />

          {/* Main Context Grid Pages (Storefront, Secure Admin Panel, and Checkout Success) */}
          <main className="flex-grow">{children}</main>

          {/* Persistent Sliding Shopping Drawer Overlay Panel */}
          <CartDrawer />

          {/* Storefront Global Structural Footer */}
          <footer className="bg-stone-900 text-stone-400 py-12 border-t-4 border-amber-600">
            <div className="max-w-7xl mx-auto px-6 text-center text-sm">
              <p className="font-serif text-amber-500 text-lg mb-2 tracking-wider">Tohfa Premium Handicrafts</p>
              <p className="text-stone-500 text-xs font-light max-w-md mx-auto mb-4">
                Supplying premium heavy brassware statement designs, artifact boxes, and corporate luxury gifting models globally.
              </p>
              <p className="text-stone-600 text-[11px] uppercase tracking-wider font-light">
                &copy; {new Date().getFullYear()} Luxury Brass Gift. All Rights Reserved.
              </p>
            </div>
          </footer>

          {/* Dynamically loads Razorpay's secure transactional modal overlay system */}
          <Script 
            src="https://checkout.razorpay.com/v1/checkout.js" 
            strategy="lazyOnload" 
          />
        </body>
      </CartProvider>
    </html>
  );
}