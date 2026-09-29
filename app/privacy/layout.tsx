// app/privacy/layout.tsx
// The page itself is a Client Component, which can't export metadata -- so
// this thin server layout carries the route's own title/description/canonical.
import { pageMetadata } from "@/app/utils/seo";

export const metadata = pageMetadata({
  title: "Privacy Policy | TOHFA",
  description:
    "How TOHFA collects, uses and protects your personal information.",
  path: "/privacy",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
