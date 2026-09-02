// app/utils/orderTypes.ts
// Companion shapes for the `orders` table's jsonb columns. The generated
// types (types/db.ts) can only say `Json` for `customer_details` /
// `shipping_address` -- Postgres doesn't constrain jsonb -- so these give
// the read sites a concrete shape without an inline cast at every call.
// Written by /api/razorpay-webhook at order creation.

export interface OrderCustomerDetails {
  name?: string;
  email?: string;
  contact?: string;
}

export interface OrderShippingAddress {
  line?: string;
  landmark?: string;
  city?: string;
  state?: string;
  pincode?: string;
  // Gift orders: the receiver's own contact number, only captured when it
  // differs from the buyer's (OTP-verified) phone -- so the courier has
  // someone to call at the delivery address. Optional, not itself verified.
  recipientPhone?: string;
}

// A line item as stored in `orders.items` (jsonb) -- written from the
// re-priced cart in /api/razorpay's order.notes, mirrored onto the row by
// the webhook. Every field is optional: it's whatever was pinned at
// checkout time, and old orders predate some of these.
export interface OrderItem {
  id?: string | number;
  name?: string;
  price?: number;
  quantity?: number;
  category?: string | null;
  image_url?: string | null;
  gstRate?: number;
}

// Narrow a jsonb value read from `orders.customer_details`. Anything that
// isn't an object (null, a stray string) collapses to {}.
export function asCustomerDetails(value: unknown): OrderCustomerDetails {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as OrderCustomerDetails)
    : {};
}

// Narrow a jsonb value read from `orders.items`. Non-arrays collapse to [].
export function asOrderItems(value: unknown): OrderItem[] {
  return Array.isArray(value) ? (value as OrderItem[]) : [];
}
