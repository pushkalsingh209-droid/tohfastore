// app/corporate/layout.tsx
// The page itself is a Client Component, which can't export metadata -- so
// this thin server layout carries the route's own title/description/canonical.
import { pageMetadata } from "@/app/utils/seo";

export const metadata = pageMetadata({
  title: "Corporate Gifting -- Brass Gifts with Logo Engraving | TOHFA",
  description:
    "Festival hampers, client gifts, employee milestones and wedding return gifts in handcrafted brass -- bulk orders with custom logo engraving, branded packaging and volume pricing.",
  path: "/corporate",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
