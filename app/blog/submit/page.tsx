// app/blog/submit/page.tsx
// Server wrapper only -- exists so this page can export noindex metadata
// (a submission utility page, not content meant for search discovery, same
// treatment as /compare and /wishlist/shared) while the actual interactive
// form lives in a Client Component (BlogSubmitForm) below it.
import type { Metadata } from "next";
import BlogSubmitForm from "@/app/components/BlogSubmitForm";

export const metadata: Metadata = {
  title: "Submit a Blog Post | TOHFA",
  description: "Share a story, craft note, or gifting idea for the TOHFA blog.",
  robots: { index: false, follow: true },
};

export default function BlogSubmitPage() {
  return <BlogSubmitForm />;
}
