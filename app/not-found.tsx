// app/not-found.tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="bg-bg min-h-screen flex flex-col justify-between transition-colors">
      <div className="flex-grow flex items-center justify-center px-4 sm:px-6 py-16">
        <div className="max-w-md w-full text-center space-y-6">
          <span className="text-link uppercase tracking-[0.3em] text-[10px] sm:text-xs font-semibold block">
            Error 404
          </span>
          <h1 className="text-4xl sm:text-5xl font-serif text-fg tracking-wide">
            Lost in the Foundry
          </h1>
          <div className="w-16 h-0.5 bg-accent mx-auto" />
          <p className="text-muted text-sm sm:text-base font-light leading-relaxed">
            The page you&rsquo;re looking for has either been moved, sold, or never cast in the first place.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center bg-fg text-bg hover:bg-accent hover:text-accent-fg text-xs uppercase tracking-wider font-semibold px-6 py-3.5 rounded shadow transition active:scale-[0.99]"
          >
            Return to Collections
          </Link>
        </div>
      </div>

      <footer className="bg-footer-bg text-footer-fg text-xs py-8 border-t border-white/10 w-full">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div>
            <p className="font-serif text-fg tracking-widest text-sm font-bold">TOHFA</p>
            <p className="text-[10px] text-faint mt-1">© 2026 tohfaonline.com. All Rights Reserved.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[11px] uppercase tracking-wider font-medium text-faint">
            <Link href="/terms" className="hover:text-footer-accent transition">Terms &amp; Conditions</Link>
            <Link href="/privacy" className="hover:text-footer-accent transition">Privacy Policy</Link>
            <Link href="/refunds" className="hover:text-footer-accent transition">Refund &amp; Cancellation</Link>
            <Link href="/contact" className="hover:text-footer-accent transition">Contact Us</Link>
            <Link href="/faq" className="hover:text-footer-accent transition">FAQ</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
