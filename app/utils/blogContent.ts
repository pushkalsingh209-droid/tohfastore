// app/utils/blogContent.ts
// Pure text helpers for the Blog section (public submission at
// /blog/submit -> admin approval -> /blog/<slug>). Kept separate from the
// DB-touching routes so the actual text logic is unit-tested without a
// database.

// Splits a submitted body into paragraphs on blank lines -- the same
// "blank line = new paragraph" convention as GiftGuide.body, just scaled to
// one big field instead of an array so the public submission form stays a
// single textarea rather than a repeatable field list.
export function splitParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

// Keyword list shown under a post (migration 0068). Ceilings keep the block
// readable and stop it turning into keyword stuffing, which search engines
// discount -- advisory sweet spot is 5-8, this is just the hard limit.
export const MAX_KEYWORDS = 12;
export const KEYWORD_MAX_LENGTH = 40;

// Accepts an admin's comma/newline separated input OR an array, and returns a
// clean list: trimmed, inner whitespace collapsed, a leading "#" dropped (an
// admin pasting "#BrassIdols" should get the keyword, not a double hash),
// de-duplicated case-insensitively (first spelling wins), and capped.
export function normalizeKeywords(input: unknown): string[] {
  const raw = Array.isArray(input) ? input : typeof input === "string" ? input.split(/[,\n]/) : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const cleaned = item.trim().replace(/^#+/, "").replace(/\s+/g, " ").trim().slice(0, KEYWORD_MAX_LENGTH).trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
    if (out.length >= MAX_KEYWORDS) break;
  }
  return out;
}

// "Lakshmi Ganesha" -> "#LakshmiGanesha". Only each word's first letter is
// upper-cased (the rest is left alone) so an acronym like "TOHFA" survives.
// Letters/marks/digits only, any script (\p{M} keeps Devanagari vowel signs,
// for Hindi tags); returns null when nothing usable is left, e.g. a keyword
// that was all punctuation.
export function keywordToHashtag(keyword: string): string | null {
  const body = keyword
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{M}\p{N}]/gu, ""))
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
  return body ? `#${body}` : null;
}

export function keywordsToHashtags(keywords: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of keywords) {
    const tag = keywordToHashtag(k);
    if (!tag || seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    out.push(tag);
  }
  return out;
}

export const EXCERPT_MAX_LENGTH = 200;

// Falls back to a truncated first paragraph when the writer left the
// excerpt field blank -- the index grid never shows an empty teaser.
export function deriveExcerpt(body: string, explicit: string): string {
  const trimmedExplicit = explicit.trim();
  if (trimmedExplicit) return trimmedExplicit.slice(0, EXCERPT_MAX_LENGTH);

  const [firstParagraph] = splitParagraphs(body);
  if (!firstParagraph) return "";
  if (firstParagraph.length <= EXCERPT_MAX_LENGTH) return firstParagraph;
  return `${firstParagraph.slice(0, EXCERPT_MAX_LENGTH - 1).trimEnd()}…`;
}
