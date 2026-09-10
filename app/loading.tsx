// app/loading.tsx
// Next.js shows this automatically (via Suspense) while the target route's
// async Server Component is fetching -- covers navigating into the homepage
// from elsewhere (including a category link) so that transition gets the
// same look as the in-page pagination/filter loading overlay.
import { randomLoadingMessage } from "@/app/utils/loadingMessages";
import BrandSpinner from "@/app/components/BrandSpinner";

export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/30 backdrop-blur-sm">
      <div className="bg-surface rounded-lg shadow-xl border border-accent-soft-border px-10 py-8 text-center min-w-[240px]">
        <BrandSpinner />
        <p className="text-sm font-serif text-muted">{randomLoadingMessage()}</p>
      </div>
    </div>
  );
}
