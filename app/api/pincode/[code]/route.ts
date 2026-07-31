// app/api/pincode/[code]/route.ts
// Proxies India Post's free public PIN code lookup (api.postalpincode.in)
// server-side -- that API doesn't send CORS headers, so the browser can't
// call it directly; this route does the fetch instead and returns just
// {city, state}. No API key, no cost, no database involved.
import { NextResponse } from "next/server";

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Enter a valid 6-digit PIN code." }, { status: 400 });
  }

  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${code}`, {
      // This lookup is only ever used to prefill a form field, so a short
      // cache keeps repeated entry of common PIN codes (e.g. testing
      // checkout) from re-hitting the upstream API every time.
      next: { revalidate: 3600 },
    });
    const data = await res.json();
    const postOffice = data?.[0]?.PostOffice?.[0];

    if (data?.[0]?.Status !== "Success" || !postOffice) {
      return NextResponse.json({ error: "Could not find that PIN code." }, { status: 404 });
    }

    return NextResponse.json({
      city: postOffice.District || postOffice.Block || "",
      state: postOffice.State || "",
    });
  } catch (err: any) {
    return NextResponse.json({ error: "PIN code lookup is unavailable right now." }, { status: 502 });
  }
}
