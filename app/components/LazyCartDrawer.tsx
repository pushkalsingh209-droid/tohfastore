// app/components/LazyCartDrawer.tsx
"use client";
import dynamic from "next/dynamic";

// CartDrawer has grown substantially with the checkout work (two-step
// form, OTP verification, the Razorpay SDK preload) -- code-splitting it
// out of the main bundle via next/dynamic shrinks what every visitor pays
// for on first load, even though it still renders immediately once
// mounted (it already returns null internally while the cart is closed,
// same as before this change -- see CartDrawer.tsx). ssr:false isn't
// allowed directly inside a Server Component (app/layout.tsx), hence this
// one small Client Component wrapper, same pattern as DeferredWidgets.tsx.
const CartDrawer = dynamic(() => import("@/app/components/CartDrawer"), { ssr: false });

export default function LazyCartDrawer() {
  return <CartDrawer />;
}
