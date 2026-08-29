// app/utils/greenApi.ts
import { normalizeIndianPhone } from "@/app/utils/phone";
// Shared Green API (WhatsApp) sender -- used by the order-confirmation
// webhook and by the lead follow-up flow. Best-effort by design: silently
// no-ops until GREEN_API_URL / GREEN_API_ID_INSTANCE / GREEN_API_TOKEN_INSTANCE
// are set, and callers are expected to catch/log rather than let a failed
// send block whatever triggered it.
//
// When imageUrl is given, sends it as an image message with `message` as
// the caption (sendFileByUrl) instead of a plain text message -- falls back
// to plain text if the image send fails for any reason (bad URL, WhatsApp
// media rejection, etc.) so a formatting problem never costs the message
// entirely.
export async function sendWhatsappMessage(phone: string, message: string, imageUrl?: string) {
  const greenApiUrl = process.env.GREEN_API_URL;
  const greenApiIdInstance = process.env.GREEN_API_ID_INSTANCE;
  const greenApiTokenInstance = process.env.GREEN_API_TOKEN_INSTANCE;
  if (!greenApiUrl || !greenApiIdInstance || !greenApiTokenInstance) return;

  const chatId = `${normalizeIndianPhone(phone)}@c.us`;

  if (imageUrl) {
    const imageRes = await fetch(
      `${greenApiUrl}/waInstance${greenApiIdInstance}/sendFileByUrl/${greenApiTokenInstance}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, urlFile: imageUrl, fileName: "tohfa-order.jpg", caption: message }),
      }
    );
    if (imageRes.ok) return;
    console.error("WhatsApp (Green API) image send failed, falling back to text:", chatId, await imageRes.text());
  }

  const res = await fetch(
    `${greenApiUrl}/waInstance${greenApiIdInstance}/sendMessage/${greenApiTokenInstance}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, message }),
    }
  );
  if (!res.ok) {
    throw new Error(`WhatsApp (Green API) send failed: ${chatId} ${await res.text()}`);
  }
}

// Checks whether a number is actually registered on WhatsApp, via Green
// API's checkWhatsapp endpoint -- no message sent, so no cost and no
// checkout friction. Used to catch typos/fake numbers before checkout,
// since order updates are sent via WhatsApp only (see CartDrawer.tsx).
//
// Returns null (not false) whenever the check itself couldn't be
// performed -- Green API not configured, network error, unexpected
// response shape -- so callers can fail open (let checkout proceed)
// instead of blocking a sale on an infrastructure hiccup unrelated to
// whether the number is actually valid.
export async function checkWhatsappNumber(phone: string): Promise<boolean | null> {
  const greenApiUrl = process.env.GREEN_API_URL;
  const greenApiIdInstance = process.env.GREEN_API_ID_INSTANCE;
  const greenApiTokenInstance = process.env.GREEN_API_TOKEN_INSTANCE;
  if (!greenApiUrl || !greenApiIdInstance || !greenApiTokenInstance) return null;

  const phoneNumber = normalizeIndianPhone(phone);

  try {
    const res = await fetch(
      `${greenApiUrl}/waInstance${greenApiIdInstance}/checkWhatsapp/${greenApiTokenInstance}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: Number(phoneNumber) }),
      }
    );
    if (!res.ok) {
      console.error("WhatsApp (Green API) checkWhatsapp failed:", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return typeof data.existsWhatsapp === "boolean" ? data.existsWhatsapp : null;
  } catch (err) {
    console.error("WhatsApp (Green API) checkWhatsapp errored:", err);
    return null;
  }
}
