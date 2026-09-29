// app/track/layout.tsx
// The page itself is a Client Component, which can't export metadata -- so
// this thin server layout carries the route's own title/description/canonical.
import { pageMetadata } from "@/app/utils/seo";

export const metadata = pageMetadata({
  title: "Track Your Order | TOHFA",
  description:
    "Track your TOHFA order with your order ID or AWB number and the phone number used at checkout.",
  path: "/track",
  noindex: true,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
