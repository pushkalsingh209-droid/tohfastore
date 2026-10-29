// app/product/[id]/loading.tsx
// Shown instantly while the (force-dynamic) product page's server data
// resolves. Mirrors the real layout -- gallery left, buy box right -- so the
// page doesn't jump when the content arrives. Sits inside the root layout, so
// the header/footer stay put; it replaces the full-screen spinner that
// app/loading.tsx would otherwise show for this route.
import Skeleton from "@/app/components/Skeleton";

export default function ProductLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8" role="status" aria-label="Loading product">
      <Skeleton className="h-4 w-48 mb-6" />
      <div className="grid md:grid-cols-2 gap-8 md:gap-12">
        <Skeleton className="aspect-square w-full" />
        <div className="space-y-4">
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-8 w-40" />
          <div className="space-y-2 pt-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-4/5" />
          </div>
          <Skeleton className="h-12 w-full mt-6" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  );
}
