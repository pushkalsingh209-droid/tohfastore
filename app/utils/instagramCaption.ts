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
import { getCategoryContent } from "@/app/utils/categoryContent";

const SITE_URL = "https://tohfaonline.com";
const INSTAGRAM_HANDLE = "@tohfaforu";
const BASE_HASHTAGS = ["#TOHFA", "#GiftIdeas"];
// "#HandmadeInIndia" / "#BrassArt" hold for every category's own copy
// (categoryContent.ts) except Board Games -- those are imported, mass-
// manufactured titles (Catan, Wingspan, ...), not brass or handmade here,
// so tagging one with either would misrepresent the product.
const CRAFT_HASHTAGS = ["#HandmadeInIndia", "#BrassArt"];
const CRAFT_HASHTAG_EXCLUDED_CATEGORIES = new Set(["Board Games"]);

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

// The site spans multiple categories, not just brass -- board games,
// polyresin décor, UV resin earrings -- so this can't hardcode a
// brass-specific line the way an earlier draft did (wrong for e.g. a board
// game or resin earring post). Pull the category's own tagline
// (categoryContent.ts, already written to match what's actually stocked in
// each category) when there is one; fall back to a material-neutral line
// that's true for anything in the catalogue.
function craftLine(category?: string | null): string {
  const content = category ? getCategoryContent(category) : null;
  return content ? `${content.tagline}, from TOHFA 🎁` : "Thoughtfully made, made to last 🎁";
}

export function buildInstagramCaption(product: InstagramCaptionProduct): string {
  const name = product.name || "this piece";
  const price = formatPrice(product.price);
  const link = `${SITE_URL}${productHref(product)}`;
  const craftHashtags = CRAFT_HASHTAG_EXCLUDED_CATEGORIES.has(product.category || "") ? [] : CRAFT_HASHTAGS;
  const hashtags = [...BASE_HASHTAGS, ...craftHashtags, categoryHashtag(product.category)].filter((t): t is string => Boolean(t));

  const lines = [
    `✨ Just found this stunning ${name} from ${INSTAGRAM_HANDLE} — TOHFA!${price ? ` ${price} 😍` : ""}`,
    craftLine(product.category),
    "",
    `Shop here: ${link}`,
    "",
    hashtags.join(" "),
  ];
  return lines.join("\n");
}
