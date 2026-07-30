// app/not-found.tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="bg-[var(--background)] dark:bg-stone-950 min-h-screen flex flex-col justify-between transition-colors">
      <div className="flex-grow flex items-center justify-center px-4 sm:px-6 py-16">
        <div className="max-w-md w-full text-center space-y-6">
          <span className="text-amber-700 dark:text-amber-500 uppercase tracking-[0.3em] text-[10px] sm:text-xs font-semibold block">
            Error 404
          </span>
          <h1 className="text-4xl sm:text-5xl font-serif text-stone-900 dark:text-stone-100 tracking-wide">
            Lost in the Foundry
          </h1>
          <div className="w-16 h-0.5 bg-amber-600 mx-auto" />
          <p className="text-stone-600 dark:text-stone-400 text-sm sm:text-base font-light leading-relaxed">
            The page you&rsquo;re looking for has either been moved, sold, or never cast in the first place.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center bg-stone-950 dark:bg-amber-700 hover:bg-amber-800 dark:hover:bg-amber-600 text-white text-xs uppercase tracking-wider font-semibold px-6 py-3.5 rounded shadow transition active:scale-[0.99]"
          >
            Return to Collections
          </Link>
        </div>
      </div>

      <footer className="bg-stone-900 text-stone-400 text-xs py-8 border-t border-stone-800 w-full">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div>
            <p className="font-serif text-stone-200 tracking-widest text-sm font-bold">TOHFA</p>
            <p className="text-[10px] text-stone-500 mt-1">© 2026 luxurybrassgift.com. All Rights Reserved.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[11px] uppercase tracking-wider font-medium text-stone-400">
            <Link href="/terms" className="hover:text-amber-400 transition">Terms &amp; Conditions</Link>
            <Link href="/privacy" className="hover:text-amber-400 transition">Privacy Policy</Link>
            <Link href="/refunds" className="hover:text-amber-400 transition">Refund &amp; Cancellation</Link>
            <Link href="/contact" className="hover:text-amber-400 transition">Contact Us</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
