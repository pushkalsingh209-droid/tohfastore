// app/utils/greenApi.ts
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

  const digits = phone.replace(/\D/g, "");
  const chatId = digits.startsWith("91") ? `${digits}@c.us` : `91${digits}@c.us`;

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
