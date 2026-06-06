// app/about/page.tsx
"use client";

export default function AboutUsPage() {
  return (
    <div className="bg-[#FAF9F6] min-h-screen py-16 px-6">
      <div className="max-w-4xl mx-auto space-y-12">
        
        {/* Brand Narrative Presentation */}
        <div className="text-center space-y-4">
          <span className="text-amber-700 uppercase tracking-[0.3em] text-xs font-semibold block">
            Our Heritage & Craft
          </span>
          <h1 className="text-4xl md:text-5xl font-serif text-stone-900 tracking-wide">
            About TOHFA
          </h1>
          <div className="w-16 h-0.5 bg-amber-600 mx-auto mt-4" />
        </div>

        {/* Editorial Story Elements */}
        <div className="bg-white border border-stone-200 rounded-lg p-8 md:p-12 shadow-sm space-y-6 text-stone-700 font-sans text-sm md:text-base leading-relaxed font-light">
          <p>
            Welcome to <span className="font-medium text-stone-900 font-serif">TOHFA</span> (luxurybrassgift.com), where timeless Indian heritage meets master metal craftsmanship. We curate and engineer premium heavy brass art pieces, luxury corporate gift boxes, and statement interior decor artifacts designed to last for generations.
          </p>
          <p>
            Every artifact in our collection is cast in pure brass by skilled regional artisans. By blending ancestral sand-casting mold blueprints with modern design revisions, we capture intricate hand-carved textures and heavy weight profiles that distinguish genuine statement art from mass-produced replicas.
          </p>
          
          {/* Core Values Information Matrix Table */}
          <div className="pt-6">
            <table className="w-full text-left border-collapse border border-stone-200">
              <thead>
                <tr className="bg-stone-50 font-serif font-bold text-stone-900 border-b border-stone-200 text-xs sm:text-sm">
                  <th className="p-3 border-r border-stone-200">Core Pillar</th>
                  <th className="p-3">Our Commitment</th>
                </tr>
              </thead>
              <tbody className="text-xs sm:text-sm font-light">
                <tr className="border-b border-stone-200">
                  <td className="p-3 font-medium text-stone-900 border-r border-stone-200">Material Integrity</td>
                  <td className="p-3">We exclusively process pure heavy brass allocations, completely free from cheap pot metals or zinc structural dilutes.</td>
                </tr>
                <tr className="border-b border-stone-200">
                  <td className="p-3 font-medium text-stone-900 border-r border-stone-200">Artisan Support</td>
                  <td className="p-3">We partner directly with traditional metal smithing families, securing fair wage frameworks and keeping ancient crafts alive.</td>
                </tr>
                <tr>
                  <td className="p-3 font-medium text-stone-900 border-r border-stone-200">Corporate Customization</td>
                  <td className="p-3">Providing bespoke custom logo laser engravings, structural velvet box modifications, and premium heavy assembly configurations.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Updated Communication Panel with Explicit Email Text Display */}
        <div className="bg-amber-950 text-stone-100 rounded-lg p-8 text-center space-y-4 shadow-md">
          <h3 className="font-serif text-xl tracking-wide text-amber-400">Direct Procurement Requests</h3>
          <p className="text-xs md:text-sm text-stone-300 max-w-xl mx-auto font-light">
            Have bulk corporate gifting needs, custom weight scaling queries, or want to consult directly? Reach out to our logistics team across our active channels.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            {/* WhatsApp Callout Action */}
            <a 
              href="https://wa.me/916302672351" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white text-xs uppercase tracking-wider font-semibold px-6 py-3.5 rounded transition shadow-sm text-center"
            >
              Chat on WhatsApp
            </a>
            
            {/* Explicit Email Placement Link Block */}
            <a 
              href="mailto:pushkalsingh209@gmail.com"
              className="w-full sm:w-auto bg-stone-900 hover:bg-stone-800 text-stone-200 text-xs font-mono px-6 py-3.5 rounded border border-stone-700 transition shadow-sm text-center tracking-wide flex items-center justify-center gap-2"
            >
              <span className="uppercase font-sans font-semibold tracking-wider text-[11px] text-stone-400">Email:</span> 
              pushkalsingh209@gmail.com
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}