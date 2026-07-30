// app/loading.tsx
// Next.js shows this automatically (via Suspense) while the target route's
// async Server Component is fetching -- covers navigating into the homepage
// from elsewhere (including a category link) so that transition gets the
// same look as the in-page pagination/filter loading overlay.
export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/30 backdrop-blur-sm">
      <div className="bg-white dark:bg-stone-900 rounded-lg shadow-xl border border-amber-200 dark:border-amber-800 px-10 py-8 text-center min-w-[240px]">
        <div className="w-10 h-10 border-4 border-amber-200 dark:border-amber-900 border-t-amber-700 dark:border-t-amber-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm font-serif text-stone-700 dark:text-stone-300">Polishing the brass...</p>
      </div>
    </div>
  );
}
