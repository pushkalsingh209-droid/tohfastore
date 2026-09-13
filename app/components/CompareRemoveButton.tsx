// app/components/CompareRemoveButton.tsx
// Removes one column from the /compare table. A plain Link recomputing the
// ?ids= URL would be enough to update what THIS page shows, but the
// floating CompareBar's list lives in CompareContext's localStorage --
// without also calling removeFromCompare here, a removed product would
// still show as "✓ Added to Compare" everywhere else and reappear the next
// time the bar's own link is clicked.
"use client";
import { useRouter } from "next/navigation";
import { useCompare } from "@/app/context/CompareContext";

export default function CompareRemoveButton({
  productId,
  remainingIds,
}: {
  productId: number;
  remainingIds: number[];
}) {
  const { removeFromCompare } = useCompare();
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        removeFromCompare(productId);
        router.push(remainingIds.length > 0 ? `/compare?ids=${remainingIds.join(",")}` : "/compare");
      }}
      className="text-[10px] uppercase tracking-wider font-semibold text-faint hover:text-danger transition"
    >
      Remove
    </button>
  );
}
