// app/utils/smsNotifications.ts
// SMS notification infrastructure. Currently a stub — ready for SMS provider integration
// (e.g., AWS SNS, Twilio, Exotel). Framework in place for when SMS is enabled.
// See IMPROVEMENTS.md Tier 3: SMS Marketing Channel.

export interface SmsNotificationPayload {
  phone: string; // Normalized: 91XXXXXXXXXX
  message: string; // Plain text, max 160 chars per message
  messageType: "order-status" | "stock-alert" | "delivery-update" | "review-reminder";
}

// SMS provider config — owner to set these env vars when adding SMS
export const SMS_CONFIG = {
  provider: process.env.SMS_PROVIDER || "none", // "aws-sns" | "twilio" | "exotel" | "none"
  enabled: process.env.SMS_ENABLED === "true",
  maxRetries: 2,
  timeout: 5000, // ms
};

// Send SMS notification (best-effort, never blocks the action that triggered it)
export async function sendSms(payload: SmsNotificationPayload): Promise<{
  ok: boolean;
  messageId?: string;
  error?: string;
}> {
  // Feature flag: SMS not yet enabled
  if (!SMS_CONFIG.enabled || SMS_CONFIG.provider === "none") {
    console.info(`[SMS] Skipped (SMS_ENABLED=${SMS_CONFIG.enabled}): ${payload.messageType} to ${payload.phone}`);
    return { ok: true }; // Silent success if disabled
  }

  // Message length validation (SMS is typically 160 chars per part)
  if (payload.message.length > 160 * 3) {
    // Allow up to 3 parts (480 chars) before truncating
    console.warn(`[SMS] Message too long (${payload.message.length} chars), truncating to 480`);
    payload.message = payload.message.slice(0, 476) + "...";
  }

  try {
    // Placeholder: actual implementation depends on SMS provider
    // This is where you'd call AWS SNS, Twilio, Exotel, etc.

    // Example stub (never actually runs):
    if (SMS_CONFIG.provider === "aws-sns") {
      // const sns = new AWS.SNS();
      // const result = await sns.publish({
      //   Message: payload.message,
      //   PhoneNumber: payload.phone,
      // }).promise();
      // return { ok: true, messageId: result.MessageId };
    }

    // For now, log to console (development only)
    console.log(`[SMS STUB] ${payload.messageType}: ${payload.phone} — "${payload.message}"`);
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    console.error(`[SMS] Failed to send ${payload.messageType}: ${error}`);
    return { ok: false, error };
  }
}

// Format common SMS messages (max 160 chars to avoid multi-part billing)
export function formatStockAlertSms(productName: string): string {
  return `🔔 ${productName} is back in stock! Order now: tohfaonline.com`;
}

export function formatOrderStatusSms(orderId: string, status: string): string {
  return `📦 Order ${orderId}: ${status}. Track: tohfaonline.com/track`;
}

export function formatDeliveryUpdateSms(courierName: string, trackingNumber: string): string {
  return `📍 Shipped via ${courierName}. Track: ${trackingNumber}`;
}

export function formatReviewReminderSms(productName: string): string {
  return `⭐ Love your ${productName}? Share a review at tohfaonline.com`;
}
