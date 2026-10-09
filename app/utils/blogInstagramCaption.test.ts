import { describe, it, expect } from "vitest";
import { buildBlogInstagramCaption } from "./blogInstagramCaption";

describe("buildBlogInstagramCaption", () => {
  it("includes the title, excerpt, link, and hashtags", () => {
    const caption = buildBlogInstagramCaption({
      slug: "dakshina-kali",
      title: "Dakshina Kali",
      excerpt: "This idol depicts Dakshina Kali, the most widely revered form of Maa Kali.",
    });
    expect(caption).toContain('"Dakshina Kali"');
    expect(caption).toContain("This idol depicts Dakshina Kali");
    expect(caption).toContain("https://tohfaonline.com/blog/dakshina-kali");
    expect(caption).toContain("#TOHFA");
    expect(caption).toContain("#TOHFACRAFTS");
    expect(caption).toContain("@tohfaforu");
  });

  it("omits the excerpt line gracefully when missing", () => {
    const caption = buildBlogInstagramCaption({ slug: "x", title: "X" });
    expect(caption).not.toContain("null");
    expect(caption).not.toContain("undefined");
  });

  it("truncates a long excerpt with an ellipsis", () => {
    const longExcerpt = "x".repeat(200);
    const caption = buildBlogInstagramCaption({ slug: "x", title: "X", excerpt: longExcerpt });
    const excerptLine = caption.split("\n")[1];
    expect(excerptLine.length).toBeLessThanOrEqual(120);
    expect(excerptLine.endsWith("…")).toBe(true);
  });

  it("is deterministic for the same input", () => {
    const post = { slug: "dakshina-kali", title: "Dakshina Kali", excerpt: "A short excerpt." };
    expect(buildBlogInstagramCaption(post)).toBe(buildBlogInstagramCaption(post));
  });

  it("appends hashtags derived from the post's keywords after the brand ones", () => {
    const caption = buildBlogInstagramCaption({
      slug: "x",
      title: "X",
      keywords: ["brass idols", "Lakshmi Ganesha", "tohfa"],
    });
    const tagLine = caption.split("\n").at(-1)!;
    expect(tagLine).toBe("#TOHFA #TOHFACRAFTS #Blog #BrassIdols #LakshmiGanesha");
  });

  it("caps the per-post hashtags at 8", () => {
    const keywords = Array.from({ length: 12 }, (_, i) => `tag${i}`);
    const tagLine = buildBlogInstagramCaption({ slug: "x", title: "X", keywords }).split("\n").at(-1)!;
    expect(tagLine.split(" ")).toHaveLength(3 + 8);
  });
});
