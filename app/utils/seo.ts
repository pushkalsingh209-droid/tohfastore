// app/utils/seo.ts
// Sitewide fallback Open Graph image, shown on any page that doesn't have a
// more specific one of its own (a product photo, a category's
// representative product). Metadata merges *shallowly* between layout and
// page -- a page's own "openGraph" key fully replaces the layout's, not
// just its "images" sub-field (see "Merging" in
// node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md)
// -- so any page that sets its own openGraph must reference this
// explicitly rather than relying on it falling through from the layout.
export const DEFAULT_OG_IMAGE = { url: "/logo-mark.png", width: 512, height: 512, alt: "TOHFA" };
