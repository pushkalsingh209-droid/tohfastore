// app/api/checkout/release/route.ts
// Frees a checkout's stock holds the instant the shopper backs out, instead
// of waiting out the 15-min TTL (migration 0043, IMPROVEMENTS.md T1 #1).
// Called best-effort / fire-and-forget from CheckoutSheet on the Razorpay
// modal's `ondismiss` and on `payment.failed`, with the `checkoutToken`
// returned by /api/razorpay. Also releases any "Gift With Purchase"
// campaign claim (migration 0063, IMPROVEMENTS.md #14a) held under the same
// token, for the same reason and on the same TTL -- an abandoned checkout
// must free its gift slot immediately rather than block the next shopper
// for up to 15 minutes.
//
// Public + unauthenticated on purpose: the token is a v4 UUID (unguessable),
// and the worst an attacker with a valid token could do is free a hold that
// hasn't converted yet -- a <=15-min availability nudge, no money/stock
// impact. Correctness never depends on this firing; the TTL is the backstop.
// Always 200, even for 0 rows (a hard tab close, a double-send, a token
// that already expired).
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { serverErrorResponse } from "@/app/utils/apiError";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  try {
    const { checkoutToken } = await req.json().catch(() => ({}));
    if (typeof checkoutToken !== "string" || !UUID_RE.test(checkoutToken)) {
      // Nothing to do -- don't even hit the DB. Still 200.
      return NextResponse.json({ released: 0 });
    }

    const { data, error } = await supabase
      .from("stock_reservations")
      .update({ status: "released" })
      .eq("checkout_token", checkoutToken)
      .eq("status", "held")
      .select("id");

    if (error) {
      // Log, but still 200 -- the TTL will reclaim these holds regardless,
      // and this endpoint is fire-and-forget from the client.
      console.error("checkout/release: could not release holds:", error);
    }

    // Same best-effort treatment for a gift campaign claim, if this
    // checkout was granted one -- a plain status flip, no RPC needed (only
    // the claim/consume side needs atomicity against a ceiling; release
    // never does, same as stock_reservations above).
    const { error: giftReleaseError } = await supabase
      .from("gift_campaign_claims")
      .update({ status: "released" })
      .eq("checkout_token", checkoutToken)
      .eq("status", "held");
    if (giftReleaseError) {
      console.error("checkout/release: could not release gift campaign claim:", giftReleaseError);
    }

    return NextResponse.json({ released: data?.length ?? 0 });
  } catch (err) {
    return serverErrorResponse("checkout/release failed", err, "Could not release the checkout hold.");
  }
}
