-- Run this in the Supabase SQL editor.
-- Manageable presets for the storefront's "Chat for ..." product-card
-- button label -- separate preset lists for in-stock vs out-of-stock
-- products. Which preset is currently shown is a plain-text value in
-- site_settings (chat_label_in_stock / chat_label_out_of_stock), the same
-- relationship default_whatsapp_number has to whatsapp_numbers -- so
-- deleting a preset here never breaks the active value, it's just text.
create table if not exists chat_button_labels (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('in_stock', 'out_of_stock')),
  label text not null check (char_length(label) between 1 and 30),
  created_at timestamptz not null default now(),
  unique (kind, label)
);

alter table chat_button_labels enable row level security;
