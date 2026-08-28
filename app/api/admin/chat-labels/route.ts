// app/api/admin/chat-labels/route.ts
// Manageable preset lists for the storefront's "Chat for ..." product-card
// button label -- separate lists for in-stock vs out-of-stock products.
// Which preset is currently shown is a separate site_settings value (see
// chat_label_in_stock / chat_label_out_of_stock in /api/admin/settings),
// same relationship whatsapp_numbers has to default_whatsapp_number --
// deleting a preset here never breaks the currently-active label, since
// that's stored as its own plain-text value, not a foreign key.
import { NextResponse } from "next/server";
import { serverErrorResponse } from "@/app/utils/apiError";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { isChatLabelKind, MAX_CHAT_LABEL_LENGTH } from "@/app/utils/chatLabels";

export async function GET() {
  const { data, error } = await supabase.from("chat_button_labels").select("*").order("kind").order("label");
  if (error) return serverErrorResponse("admin chat-labels", error);
  return NextResponse.json({ labels: data || [] });
}

export async function POST(req: Request) {
  try {
    const { kind, label } = await req.json();
    if (!isChatLabelKind(kind)) {
      return NextResponse.json({ error: "Invalid label kind." }, { status: 400 });
    }
    const trimmed = String(label || "").trim();
    if (!trimmed) return NextResponse.json({ error: "Please enter a label." }, { status: 400 });
    if (trimmed.length > MAX_CHAT_LABEL_LENGTH) {
      return NextResponse.json({ error: `Label must be ${MAX_CHAT_LABEL_LENGTH} characters or fewer.` }, { status: 400 });
    }

    const { data, error } = await supabase.from("chat_button_labels").insert([{ kind, label: trimmed }]).select().single();
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: `"${trimmed}" is already saved for this label.` }, { status: 400 });
      return serverErrorResponse("admin chat-labels", error);
    }

    return NextResponse.json({ label: data });
  } catch (err) {
    return serverErrorResponse("admin chat-labels", err);
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing label id." }, { status: 400 });

    const { error } = await supabase.from("chat_button_labels").delete().eq("id", id);
    if (error) return serverErrorResponse("admin chat-labels", error);

    return NextResponse.json({ success: true });
  } catch (err) {
    return serverErrorResponse("admin chat-labels", err);
  }
}
