// app/faq/layout.tsx
// The page itself is a Client Component, which can't export metadata -- so
// this thin server layout carries the route's own title/description/canonical.
import { pageMetadata } from "@/app/utils/seo";

export const metadata = pageMetadata({
  title: "FAQ -- Orders, Shipping, Refunds & Gifting | TOHFA",
  description:
    "Answers to common questions about ordering from TOHFA: WhatsApp verification, delivery in India, GST invoices, cancellations and refunds, bulk and corporate gifting.",
  path: "/faq",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
