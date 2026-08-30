// app/components/BackToCollectionsLink.tsx
// A plain `<a href="/">` always lands on the unfiltered homepage, even when
// the visitor arrived here from a specific category/page (those switches
// go through real router.push() calls in CatalogSection.tsx, so the browser
// history already holds that filtered URL). router.back() reuses that
// history entry instead, so "Back to Collections" actually returns to the
// category/page the visitor came from. Falls back to "/" only when there's
// nowhere to go back to (e.g. arriving here directly via a shared link).
"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function BackToCollectionsLink() {
  const router = useRouter();

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }

  return (
    <Link
      href="/"
      onClick={handleClick}
      className="inline-block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 hover:text-amber-700 dark:hover:text-amber-500 transition mb-6"
    >
      &larr; Back to Collections
    </Link>
  );
}
