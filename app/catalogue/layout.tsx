// app/catalogue/layout.tsx
// The page itself is a Client Component, which can't export metadata -- so
// this thin server layout carries the route's own title/description/canonical.
import { pageMetadata } from "@/app/utils/seo";

export const metadata = pageMetadata({
  title: "Download the TOHFA Catalogue -- Brass Idols, Diyas & Gifts (PDF)",
  description:
    "Download the full TOHFA catalogue: every product organised by category with photos and prices, handy for browsing offline or choosing a gift.",
  path: "/catalogue",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
