// app/refunds/layout.tsx
// The page itself is a Client Component, which can't export metadata -- so
// this thin server layout carries the route's own title/description/canonical.
import { pageMetadata } from "@/app/utils/seo";

export const metadata = pageMetadata({
  title: "Cancellation & Refund Policy | TOHFA",
  description:
    "TOHFA's cancellation, refund and damaged-item policy for online orders, including how to claim for a defective piece.",
  path: "/refunds",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
