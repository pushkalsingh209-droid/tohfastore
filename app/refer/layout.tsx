// app/refer/layout.tsx
// The page itself is a Client Component, which can't export metadata -- so
// this thin server layout carries the route's own title/description/canonical.
import { pageMetadata } from "@/app/utils/seo";

export const metadata = pageMetadata({
  title: "Your Referral Code | TOHFA",
  description:
    "Look up your TOHFA referral code and share it with friends.",
  path: "/refer",
  noindex: true,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
