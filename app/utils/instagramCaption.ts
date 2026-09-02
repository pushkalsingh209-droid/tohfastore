// app/utils/instagramCaption.ts
// The ready-to-paste caption for the public "Create Insta Post" tool
// (InstagramPostGenerator.tsx / /api/instagram-post-image). Written in
// FIRST PERSON, deliberately -- unlike every other message-builder in this
// codebase (orderNotifications.ts, whatsapp.ts), the poster here is a third
// party (a customer, a friend) sharing this as their own content, not the
// store talking to a customer. Pure and deterministic, so callers compute
// it client-side straight from data already on the product page -- no
// extra request, unlike the image itself which has to be server-rendered.

import { productHref } from "@/app/utils/slug";

const SITE_URL = "https://tohfaonline.com";
const INSTAGRAM_HANDLE = "@tohfaforu";
const BASE_HASHTAGS = ["#TOHFA", "#HandmadeInIndia", "#BrassArt", "#GiftIdeas"];

export interface InstagramCaptionProduct {
  id: number | string;
  name?: string | null;
  price?: number | string | null;
  category?: string | null;
}

// "Pocket Temples" -> "#PocketTemples". Non-letters/digits dropped rather
// than hyphenated, since Instagram hashtags can't contain punctuation.
function categoryHashtag(category?: string | null): string | null {
  if (!category) return null;
  const tag = category
    .split(/\s+/)
    .map((word) => word.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(Boolean)
    .join("");
  return tag ? `#${tag}` : null;
}

function formatPrice(price?: number | string | null): string | null {
  const n = Number(price);
  return Number.isFinite(n) && n > 0 ? `₹${n.toLocaleString("en-IN")}` : null;
}

export function buildInstagramCaption(product: InstagramCaptionProduct): string {
  const name = product.name || "this piece";
  const price = formatPrice(product.price);
  const link = `${SITE_URL}${productHref(product)}`;
  const hashtags = [...BASE_HASHTAGS, categoryHashtag(product.category)].filter((t): t is string => Boolean(t));

  const lines = [
    `✨ Just found this stunning ${name} from ${INSTAGRAM_HANDLE} — TOHFA!${price ? ` ${price} 😍` : ""}`,
    "Handcrafted brass, made to last for generations 🎁",
    "",
    `Shop here: ${link}`,
    "",
    hashtags.join(" "),
  ];
  return lines.join("\n");
}
