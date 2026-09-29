// app/wishlist/layout.tsx
// The page itself is a Client Component, which can't export metadata -- so
// this thin server layout carries the route's own title/description/canonical.
import { pageMetadata } from "@/app/utils/seo";

export const metadata = pageMetadata({
  title: "Your Wishlist | TOHFA",
  description:
    "Your saved TOHFA products.",
  path: "/wishlist",
  noindex: true,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
