// app/contact/page.tsx
"use client";

export default function ContactUsPage() {
  return (
    <div className="bg-[#FAF9F6] min-h-screen py-16 px-6 font-sans text-stone-700">
      <div className="max-w-2xl mx-auto bg-white border border-stone-200 rounded-lg p-8 md:p-12 shadow-sm space-y-8 text-sm font-light">
        <div>
          <h1 className="text-3xl font-serif text-stone-900 font-medium">Contact Us</h1>
          <p className="text-stone-500 text-xs mt-1">Official corporate compliance channels for TOHFA</p>
          <hr className="border-stone-100 mt-4" />
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-xs uppercase tracking-wider text-stone-400 font-bold mb-1">Corporate Identity</h3>
            <p className="text-stone-900 font-medium font-serif text-base">TOHFA  (luxurybrassgift.com)</p>
          </div>

          <div>
            <h3 className="text-xs uppercase tracking-wider text-stone-400 font-bold mb-1">Electronic Mail Service</h3>
            <a href="mailto:pushkalsingh209@gmail.com" className="text-amber-800 font-mono font-medium hover:underline text-sm">
              pushkalsingh209@gmail.com
            </a>
          </div>

          <div>
            <h3 className="text-xs uppercase tracking-wider text-stone-400 font-bold mb-1">Mobile / WhatsApp Communication Node</h3>
            <p className="text-stone-900 font-medium font-mono text-sm">+91 6302672351</p>
            <br /><br />
            <p>
            <a 
              href="https://wa.me/916302672351" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white text-xs uppercase tracking-wider font-semibold px-6 py-3.5 rounded transition shadow-sm text-center"
            >
              Chat on WhatsApp
            </a>
            </p>
          </div>

          <div>
            <h3 className="text-xs uppercase tracking-wider text-stone-400 font-bold mb-1">Registered Operational Hub</h3>
            <p className="text-stone-800 font-light leading-relaxed">
              TOHFA,<br />
              Dehradun, Uttarakhand,<br />
              India - 248001
            </p>
          </div>
        </div>

        <div className="pt-6 border-t border-stone-100 text-[11px] text-stone-400 text-center leading-relaxed">
          Operational customer assistance tickets are monitored and processed directly by our logistics desk from Monday through Saturday, between 10:00 AM and 6:00 PM IST.
        </div>
      </div>
    </div>
  );
}