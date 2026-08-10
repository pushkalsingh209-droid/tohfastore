// app/utils/catalogueGenerator.ts
// Shared PDF-generation logic behind both /api/admin/catalogue (direct
// admin download) and /api/catalogue (public, gated behind the /catalogue
// lead-capture form) -- one implementation so the branding/layout only
// needs to be maintained in one place. Uses @react-pdf/renderer (pure JS,
// no headless-browser binary) rather than Puppeteer -- much lighter and
// more reliable inside a Vercel serverless function than shipping a
// Chromium binary for an occasionally-used feature.
import path from "path";
import fs from "fs";
import React from "react";
import sharp from "sharp";
import { unstable_cache } from "next/cache";
import { Document, Page, View, Text, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { calculateSlashedPrice } from "@/app/utils/pricing";
import { formatProductDimensionsLine } from "@/app/utils/productDimensions";
import { getProductUnitSettings } from "@/app/utils/storeQueries";

// Product photos are uploaded at full resolution for the storefront, but a
// catalogue card only ever displays one at ~150pt wide -- embedding the
// originals directly bloated a 47-product PDF to ~19MB (too heavy to
// email/share). Re-encoding each to a small JPEG thumbnail first keeps the
// file a fraction of that size without a visible quality loss at print
// size. A failed fetch/resize just omits that one photo rather than
// failing the whole catalogue.
async function fetchThumbnail(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return await sharp(Buffer.from(arrayBuffer))
      .resize({ width: 400, height: 320, fit: "cover" })
      .jpeg({ quality: 72 })
      .toBuffer();
  } catch {
    return null;
  }
}

const MAROON = "#3d1113";
const AMBER = "#b45309";
const CREAM = "#FFF0CF";
const INK = "#241010";

const styles = StyleSheet.create({
  coverPage: {
    backgroundColor: MAROON,
    padding: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  coverLogo: { width: 96, height: 96, marginBottom: 20, borderRadius: 20 },
  coverBrand: { fontSize: 32, color: "#e8c468", letterSpacing: 6, fontWeight: 700 },
  coverTagline: { fontSize: 10, color: "#d9c9ab", letterSpacing: 3, marginTop: 6, textTransform: "uppercase" },
  coverTitle: { fontSize: 18, color: "#f6eedd", marginTop: 40 },
  coverDate: { fontSize: 9, color: "#a98d63", marginTop: 8 },
  coverContact: {
    marginTop: 36,
    alignItems: "center",
    borderTop: "0.5pt solid #6b3a3c",
    paddingTop: 20,
    gap: 4,
  },
  coverContactLine: { fontSize: 9, color: "#e8c468" },

  page: { backgroundColor: CREAM, padding: 28, fontSize: 9 },
  categoryHeading: {
    fontSize: 16,
    color: AMBER,
    borderBottom: `1.5pt solid ${AMBER}`,
    paddingBottom: 8,
    marginBottom: 14,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: {
    width: 160,
    backgroundColor: "#ffffff",
    borderRadius: 6,
    padding: 8,
    marginBottom: 12,
    border: "0.5pt solid #e7d9b8",
  },
  cardImage: { width: "100%", height: 110, borderRadius: 4, objectFit: "cover", marginBottom: 6 },
  cardName: { fontSize: 9, fontWeight: 700, color: INK, marginBottom: 3 },
  cardPriceRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  cardPrice: { fontSize: 10, color: AMBER, fontWeight: 700 },
  cardOriginalPrice: { fontSize: 7, color: "#a8a29e", textDecoration: "line-through" },
  cardBadge: { fontSize: 6, color: "#15803d", fontWeight: 700, textTransform: "uppercase" },
  cardDimensions: { fontSize: 6.5, color: "#78716c", marginTop: 3 },
  cardStock: { fontSize: 7, color: "#b91c1c", marginTop: 2, textTransform: "uppercase" },

  footer: {
    position: "absolute",
    bottom: 16,
    left: 28,
    right: 28,
    fontSize: 7,
    color: "#8a6d3f",
    flexDirection: "row",
    justifyContent: "space-between",
    borderTop: "0.5pt solid #e7d9b8",
    paddingTop: 6,
  },
});

function Footer({ pageLabel }: { pageLabel: string }) {
  return React.createElement(
    View,
    { style: styles.footer, fixed: true },
    React.createElement(Text, null, "tohfaonline.com  ·  WhatsApp +91 6302672351  ·  contact@tohfaonline.com"),
    React.createElement(Text, { render: ({ pageNumber, totalPages }: any) => `${pageLabel} · ${pageNumber} / ${totalPages}` })
  );
}

export async function generateCatalogueBuffer(): Promise<Buffer> {
  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, price, category, image_url, inventory, display_order, created_at, weight_g, height_cm, depth_cm, breadth_cm")
    .order("category", { ascending: true, nullsFirst: false })
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  // Same admin-configurable weight/dimension display units the storefront
  // itself uses (see ProductCard/product detail page), so the catalogue's
  // "Wt: 250 g  •  H 12 × D 8 cm" line matches what a shopper sees on-site.
  const unitSettings = await getProductUnitSettings();

  // Category discount % map -- drives the "MRP Rs. X, Y% off" shown per
  // card below. Best-effort: an empty map just means plain prices.
  const categoryDiscounts: Record<string, number> = {};
  try {
    const { data: categoryRows } = await supabase.from("categories").select("name, discount_percent");
    for (const row of categoryRows || []) {
      if (row.discount_percent != null) categoryDiscounts[row.name] = Number(row.discount_percent);
    }
  } catch (discountErr) {
    console.error("Category discount lookup failed:", discountErr);
  }

  const grouped = new Map<string, any[]>();
  for (const product of products || []) {
    const category = product.category || "Uncategorized";
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category)!.push(product);
  }
  const categories = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b));

  const logoPath = path.join(process.cwd(), "public", "logo-mark.png");
  const logoBuffer = fs.readFileSync(logoPath);

  const generatedOn = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  // Re-encode every product photo to a small thumbnail up front (see
  // fetchThumbnail above) so the embedded images don't bloat the PDF.
  const allProducts = products || [];
  const thumbnailEntries = await Promise.all(
    allProducts.map(async (p) => [p.id, p.image_url ? await fetchThumbnail(p.image_url) : null] as const)
  );
  const thumbnails = new Map(thumbnailEntries);

  const doc = React.createElement(
    Document,
    { title: "TOHFA Product Catalogue" },
    // Cover page
    React.createElement(
      Page,
      { size: "A4", style: styles.coverPage },
      React.createElement(Image, { src: logoBuffer, style: styles.coverLogo }),
      React.createElement(Text, { style: styles.coverBrand }, "TOHFA"),
      React.createElement(Text, { style: styles.coverTagline }, "Luxury Gift Paradise"),
      React.createElement(Text, { style: styles.coverTitle }, "Product Catalogue"),
      React.createElement(Text, { style: styles.coverDate }, `Generated on ${generatedOn}`),
      React.createElement(
        View,
        { style: styles.coverContact },
        React.createElement(Text, { style: styles.coverContactLine }, "tohfaonline.com"),
        React.createElement(Text, { style: styles.coverContactLine }, "WhatsApp: +91 6302672351"),
        React.createElement(Text, { style: styles.coverContactLine }, "Email: contact@tohfaonline.com")
      )
    ),
    // One page-flow per category (React-PDF auto-paginates within a Page's content when it overflows -- but a single <Page> can't auto-grow past one sheet with wrapping content unless using `wrap`, so each category gets its own Page(s) via the library's automatic content-driven pagination)
    ...categories.map((category) =>
      React.createElement(
        Page,
        { key: category, size: "A4", style: styles.page, wrap: true },
        React.createElement(Text, { style: styles.categoryHeading }, category),
        React.createElement(
          View,
          { style: styles.grid },
          ...grouped.get(category)!.map((product) => {
            const thumb = thumbnails.get(product.id);
            const slashed = calculateSlashedPrice(Number(product.price), categoryDiscounts[product.category]);
            const dimensionsLine = formatProductDimensionsLine(product, unitSettings.weightUnit, unitSettings.dimensionUnit);
            return React.createElement(
              View,
              { key: product.id, style: styles.card, wrap: false },
              thumb ? React.createElement(Image, { src: thumb, style: styles.cardImage }) : null,
              React.createElement(Text, { style: styles.cardName }, product.name),
              React.createElement(
                View,
                { style: styles.cardPriceRow },
                React.createElement(Text, { style: styles.cardPrice }, `Rs. ${Number(product.price).toLocaleString("en-IN")}`),
                slashed
                  ? React.createElement(Text, { style: styles.cardOriginalPrice }, `Rs. ${slashed.originalPrice.toLocaleString("en-IN")}`)
                  : null
              ),
              slashed ? React.createElement(Text, { style: styles.cardBadge }, `${slashed.discountPercent}% off`) : null,
              dimensionsLine ? React.createElement(Text, { style: styles.cardDimensions }, dimensionsLine) : null,
              Number(product.inventory) <= 0
                ? React.createElement(Text, { style: styles.cardStock }, "Out of Stock")
                : null
            );
          })
        ),
        React.createElement(Footer, { pageLabel: category })
      )
    )
  );

  return renderToBuffer(doc as any);
}

// The public /api/catalogue download doesn't need a fresh render on every
// hit -- products don't change minute to minute, and a full render re-fetches
// and re-encodes every product photo (the slow, expensive part). Cached as
// base64 (not the raw Buffer) since that's what unstable_cache can safely
// serialize/restore across invocations. The admin download route calls
// generateCatalogueBuffer() directly instead, so admins always get the
// live catalogue rather than up to an hour of staleness.
export const getCachedCatalogueBase64 = unstable_cache(
  async () => (await generateCatalogueBuffer()).toString("base64"),
  ["public-catalogue-pdf"],
  { revalidate: 3600 }
);
