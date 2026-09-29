// app/contact/layout.tsx
// The page itself is a Client Component, which can't export metadata -- so
// this thin server layout carries the route's own title/description/canonical.
import { pageMetadata } from "@/app/utils/seo";

export const metadata = pageMetadata({
  title: "Contact TOHFA -- Dehradun, Uttarakhand",
  description:
    "Get in touch with TOHFA for order help, product questions or bulk enquiries. WhatsApp +91 6302672351 or write to us -- we reply within one business day.",
  path: "/contact",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
