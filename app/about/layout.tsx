// app/about/layout.tsx
// The page itself is a Client Component, which can't export metadata -- so
// this thin server layout carries the route's own title/description/canonical.
import { pageMetadata } from "@/app/utils/seo";

export const metadata = pageMetadata({
  title: "About TOHFA -- Handcrafted Brass Artifacts from Dehradun",
  description:
    "The story behind TOHFA: lightweight brass idols, diyas and decor cast by skilled artisans, founded by self-taught artist Sakshi Singh in Dehradun.",
  path: "/about",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
