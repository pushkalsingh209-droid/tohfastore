import { describe, it, expect } from "vitest";
import { splitParagraphs, deriveExcerpt } from "./blogContent";

describe("splitParagraphs", () => {
  it("splits on a blank line", () => {
    expect(splitParagraphs("First paragraph.\n\nSecond paragraph.")).toEqual([
      "First paragraph.",
      "Second paragraph.",
    ]);
  });

  it("splits on multiple blank lines / extra whitespace between them", () => {
    expect(splitParagraphs("One.\n\n\n   \nTwo.")).toEqual(["One.", "Two."]);
  });

  it("trims each paragraph", () => {
    expect(splitParagraphs("  Padded.  \n\n  Also padded.  ")).toEqual(["Padded.", "Also padded."]);
  });

  it("drops empty paragraphs", () => {
    expect(splitParagraphs("Only one.\n\n\n\n")).toEqual(["Only one."]);
  });

  it("returns a single paragraph for a body with no blank line", () => {
    expect(splitParagraphs("Just one line, no blank line break.")).toEqual([
      "Just one line, no blank line break.",
    ]);
  });

  it("returns an empty array for blank input", () => {
    expect(splitParagraphs("   \n\n  ")).toEqual([]);
  });
});

describe("deriveExcerpt", () => {
  it("uses the explicit excerpt when provided", () => {
    expect(deriveExcerpt("Body text.\n\nMore.", "A hand-written teaser.")).toBe("A hand-written teaser.");
  });

  it("trims the explicit excerpt", () => {
    expect(deriveExcerpt("Body.", "  Padded teaser.  ")).toBe("Padded teaser.");
  });

  it("falls back to the first paragraph when excerpt is blank", () => {
    expect(deriveExcerpt("First paragraph here.\n\nSecond paragraph.", "")).toBe("First paragraph here.");
  });

  it("falls back to the first paragraph when excerpt is only whitespace", () => {
    expect(deriveExcerpt("First paragraph here.\n\nSecond.", "   ")).toBe("First paragraph here.");
  });

  it("truncates a long first paragraph with an ellipsis", () => {
    const longPara = "x".repeat(250);
    const result = deriveExcerpt(longPara, "");
    expect(result.length).toBe(200);
    expect(result.endsWith("…")).toBe(true);
  });

  it("does not truncate a first paragraph at exactly the max length", () => {
    const exact = "x".repeat(200);
    expect(deriveExcerpt(exact, "")).toBe(exact);
  });

  it("returns an empty string when both excerpt and body are blank", () => {
    expect(deriveExcerpt("", "")).toBe("");
  });

  it("truncates a long explicit excerpt too", () => {
    const longExcerpt = "y".repeat(250);
    const result = deriveExcerpt("body", longExcerpt);
    expect(result.length).toBe(200);
  });
});
