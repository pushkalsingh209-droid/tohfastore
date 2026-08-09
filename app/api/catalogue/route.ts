// app/api/catalogue/route.ts
// Public PDF download, reached via the /catalogue lead-capture page after
// a visitor submits their details (a UX gate, not a hard server-side one --
// consistent with how gated content typically works for a small business
// site, not worth the added complexity of signed download tokens here).
import { NextResponse } from "next/server";
import { getCachedCatalogueBase64 } from "@/app/utils/catalogueGenerator";

export const maxDuration = 60;

export async function GET() {
  try {
    const base64 = await getCachedCatalogueBase64();
    const buffer = Buffer.from(base64, "base64");
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="tohfa-catalogue-${new Date().toISOString().slice(0, 10)}.pdf"`,
      },
    });
  } catch (err: any) {
    console.error("Catalogue PDF generation failed:", err);
    return NextResponse.json({ error: err.message || "Could not generate catalogue." }, { status: 500 });
  }
}
