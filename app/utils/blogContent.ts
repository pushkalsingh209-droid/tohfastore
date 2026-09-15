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
