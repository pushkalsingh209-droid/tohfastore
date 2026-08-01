// app/api/admin/catalogue/route.ts
// Direct admin download of the branded, category-wise product catalogue --
// see app/utils/catalogueGenerator.ts for the actual PDF-building logic,
// shared with the public /api/catalogue route (gated behind the
// /catalogue lead-capture form).
import { NextResponse } from "next/server";
import { generateCatalogueBuffer } from "@/app/utils/catalogueGenerator";

export const maxDuration = 60;

export async function GET() {
  try {
    const buffer = await generateCatalogueBuffer();
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
