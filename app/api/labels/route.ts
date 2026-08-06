// app/api/labels/route.ts
// Public (not gated by the admin middleware) -- distinct label names
// currently in use on products, so the header's label menu and the catalog
// filter dropdown only ever offer labels that actually have products,
// self-maintaining as products are re-labeled or deleted.
import { NextResponse } from "next/server";
import { getActiveLabelNames, getLabelPhotoFilters } from "@/app/utils/storeQueries";

export async function GET() {
  const [labels, photoFilters] = await Promise.all([getActiveLabelNames(), getLabelPhotoFilters()]);
  return NextResponse.json({ labels, photoFilters });
}
