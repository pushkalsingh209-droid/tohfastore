// app/utils/seo.ts
import type { Metadata } from "next";

// Sitewide fallback Open Graph image, shown on any page that doesn't have a
// more specific one of its own (a product photo, a category's
// representative product). Metadata merges *shallowly* between layout and
// page -- a page's own "openGraph" key fully replaces the layout's, not
// just its "images" sub-field (see "Merging" in
// node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md)
// -- so any page that sets its own openGraph must reference this
// explicitly rather than relying on it falling through from the layout.
export const DEFAULT_OG_IMAGE = { url: "/logo-mark.png", width: 512, height: 512, alt: "TOHFA" };

// Per-page metadata for the static/utility routes. Every one of these used
// to inherit the root layout's title + description verbatim (so /corporate,
// /about, /refunds... all showed as the homepage in search results and had no
// canonical). Metadata merges shallowly -- a page's own `openGraph` replaces
// the layout's whole block -- so this sets title/description/url/image
// together rather than leaving OG to fall back to the homepage's copy.
// `noindex` is for pages with no indexable content of their own (a
// localStorage wishlist, an order-tracking form).

export function pageMetadata(opts: {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
}): Metadata {
  const { title, description, path, noindex } = opts;
  return {
    title,
    description,
    alternates: { canonical: path },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: { title, description, url: path, siteName: "TOHFA", type: "website", images: [DEFAULT_OG_IMAGE] },
  };
}
