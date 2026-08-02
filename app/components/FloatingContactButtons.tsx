// app/components/FloatingContactButtons.tsx
// The header's Email/Call/Chat row is desktop-only (hidden on mobile to
// keep that row from crowding), so mobile gets its own always-visible
// shortcut instead -- a small floating WhatsApp + email pair, the pattern
// most e-commerce sites use to keep contact one tap away.
import { WHATSAPP_NUMBER } from "@/app/utils/whatsapp";

const GENERAL_INQUIRY_MESSAGE = "Hi! I want to enquire about Tohfa products.";

export default function FloatingContactButtons() {
  return (
    <div className="md:hidden fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2.5 print:hidden">
      <a
        href="mailto:contact@tohfaonline.com"
        aria-label="Email TOHFA"
        className="w-11 h-11 rounded-full bg-stone-900 dark:bg-amber-700 hover:bg-stone-800 dark:hover:bg-amber-600 text-white flex items-center justify-center shadow-lg active:scale-95 transition"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16v12H4z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 7l8 6 8-6" />
        </svg>
      </a>
      <a
        href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(GENERAL_INQUIRY_MESSAGE)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat on WhatsApp"
        className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg active:scale-95 transition"
      >
        <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.713-1.457L0 24zm6.59-4.846c1.66.986 3.296 1.489 4.974 1.49 5.405 0 9.811-4.366 9.815-9.736.002-2.599-1.002-5.045-2.83-6.876C16.718 2.2 14.28 1.2 11.999 1.2c-5.41 0-9.821 4.366-9.825 9.736a9.617 9.617 0 0 0 1.503 5.123L2.68 20.2l4.411-1.154z" />
        </svg>
      </a>
    </div>
  );
}
