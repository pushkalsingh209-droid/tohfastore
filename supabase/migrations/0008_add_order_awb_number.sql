-- Run this in the Supabase SQL editor.
-- Optional courier AWB / logistics tracking number per order, settable by
-- the admin once an order ships. Customers can then search the public
-- order-tracking page by either their Order ID or this tracking number.

alter table orders add column if not exists awb_number text;

create index if not exists orders_awb_number_idx on orders(awb_number);
