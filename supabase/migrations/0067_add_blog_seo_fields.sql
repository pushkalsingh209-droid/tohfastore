-- Run this in the Supabase SQL editor.
-- Admin-overridable SEO title/description for blog posts (owner: "add all
-- those features in blog post which would be SEO friendly and SEO
-- enhancing"). A writer's own title ("Dakshina Kali") is often not what
-- ranks best in search -- these are optional; when blank, the post falls
-- back to the auto-generated <title>/description already in use
-- (title + " | TOHFA Blog", and the post's own excerpt), same as before
-- this migration. Editable in the admin Blog tab alongside the existing
-- title/excerpt/category/body/product-link fields.

alter table blog_posts
  add column if not exists meta_title text,
  add column if not exists meta_description text;
