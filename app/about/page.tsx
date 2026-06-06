// app/about/page.tsx
"use client";

export default function AboutUsPage() {
  return (
    <div className="bg-[#FAF9F6] min-h-screen flex flex-col justify-between">
      
      {/* BRAND CONTENT MAIN WRAPPER SECTION */}
      <div className="flex-grow py-12 md:py-16 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto space-y-10 md:space-y-12">
          
          {/* Brand Narrative Presentation */}
          <div className="text-center space-y-3">
            <span className="text-amber-700 uppercase tracking-[0.3em] text-[10px] sm:text-xs font-semibold block">
              Our Heritage & Craft
            </span>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif text-stone-900 tracking-wide">
              About TOHFA
            </h1>
            <div className="w-16 h-0.5 bg-amber-600 mx-auto mt-4" />
          </div>

          {/* Editorial Story Elements */}
          <div className="bg-white border border-stone-200 rounded-lg p-5 sm:p-8 md:p-12 shadow-sm space-y-6 text-stone-700 font-sans text-xs sm:text-sm md:text-base leading-relaxed font-light">
            <p>
              Welcome to <span className="font-medium text-stone-900 font-serif">TOHFA</span> (luxurybrassgift.com), where timeless Indian heritage meets master metal craftsmanship. We curate and engineer premium heavy brass art pieces, luxury corporate gift boxes, and statement interior decor artifacts designed to last for generations.
            </p>
            <p>
              Every artifact in our collection is cast in pure brass by skilled regional artisans. By blending ancestral sand-casting mold blueprints with modern design revisions, we capture intricate hand-carved textures and heavy weight profiles that distinguish genuine statement art from mass-produced replicas.
            </p>
            
            {/* Core Values Information Matrix Table (With horizontal mobile scrolling protect wrapper) */}
            <div className="pt-4 overflow-x-auto -mx-5 px-5 sm:mx-0 sm:px-0">
              <div className="inline-block min-w-full align-middle">
                <table className="min-w-full text-left border-collapse border border-stone-200">
                  <thead>
                    <tr className="bg-stone-50 font-serif font-bold text-stone-900 border-b border-stone-200 text-[11px] sm:text-xs md:text-sm">
                      <th className="p-3 border-r border-stone-200 whitespace-nowrap w-1/3">Core Pillar</th>
                      <th className="p-3">Our Commitment</th>
                    </tr>
                  </thead>
                  <tbody className="text-[11px] sm:text-xs md:text-sm font-light leading-normal">
                    <tr className="border-b border-stone-200">
                      <td className="p-3 font-medium text-stone-900 border-r border-stone-200 font-serif">Material Integrity</td>
                      <td className="p-3 text-stone-600">We exclusively process pure heavy brass allocations, completely free from cheap pot metals or zinc structural dilutes.</td>
                    </tr>
                    <tr className="border-b border-stone-200">
                      <td className="p-3 font-medium text-stone-900 border-r border-stone-200 font-serif">Artisan Support</td>
                      <td className="p-3 text-stone-600">We partner directly with traditional metal smithing families, securing fair wage frameworks and keeping ancient crafts alive.</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium text-stone-900 border-r border-stone-200 font-serif">Corporate Customization</td>
                      <td className="p-3 text-stone-600">Providing bespoke custom logo laser engravings, structural velvet box modifications, and premium heavy assembly configurations.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Updated Communication Panel with Explicit Email Text Display */}
          <div className="bg-amber-950 text-stone-100 rounded-lg p-6 sm:p-8 md:p-10 text-center space-y-4 shadow-md">
            <h3 className="font-serif text-lg sm:text-xl tracking-wide text-amber-400 font-medium">Direct Procurement Requests</h3>
            <p className="text-[11px] sm:text-xs md:text-sm text-stone-300 max-w-xl mx-auto font-light leading-relaxed">
              Have bulk corporate gifting needs, custom weight scaling queries, or want to consult directly? Reach out to our logistics team across our active channels.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
              {/* WhatsApp Callout Action */}
              <a 
                href="https://wa.me/916302672351" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white text-xs uppercase tracking-wider font-semibold px-6 py-3.5 rounded transition shadow-sm text-center active:scale-[0.99] flex items-center justify-center gap-2"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.713-1.457L0 24zm6.59-4.846c1.66.986 3.296 1.489 4.974 1.49 5.405 0 9.811-4.366 9.815-9.736.002-2.599-1.002-5.045-2.83-6.876C16.718 2.2 14.28 1.2 11.999 1.2c-5.41 0-9.821 4.366-9.825 9.736a9.617 9.617 0 0 0 1.503 5.123L2.68 20.2l4.411-1.154z"/>
                </svg>
                <span>Chat on WhatsApp</span>
              </a>
              
              {/* Explicit Email Placement Link Block */}
              <a 
                href="mailto:pushkalsingh209@gmail.com"
                className="w-full sm:w-auto bg-stone-900 hover:bg-stone-800 text-stone-200 text-xs font-mono px-5 py-3.5 rounded border border-stone-800 transition shadow-sm text-center tracking-wide flex items-center justify-center gap-1.5 break-all active:scale-[0.99]"
              >
                <span className="uppercase font-sans font-semibold tracking-wider text-[10px] text-stone-400">Email:</span> 
                pushkalsingh209@gmail.com
              </a>
            </div>
          </div>

        </div>
      </div>

      {/* MANDATORY COMPLIANCE LINK FOOTER SECTION */}
      <footer className="bg-stone-900 text-stone-400 text-xs py-8 border-t border-stone-800 w-full mt-auto">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div>
            <p className="font-serif text-stone-200 tracking-widest text-sm font-bold">TOHFA</p>
            <p className="text-[10px] text-stone-500 mt-1">© 2026 luxurybrassgift.com. All Rights Reserved.</p>
          </div>
          
          {/* Public links verified during gateway inspections */}
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[11px] uppercase tracking-wider font-medium text-stone-400">
            <a href="/terms" className="hover:text-amber-400 transition">Terms & Conditions</a>
            <a href="/privacy" className="hover:text-amber-400 transition">Privacy Policy</a>
            <a href="/refunds" className="hover:text-amber-400 transition">Refund & Cancellation</a>
            <a href="/contact" className="hover:text-amber-400 transition">Contact Us</a>
          </div>
        </div>
      </footer>

    </div>
  );
}