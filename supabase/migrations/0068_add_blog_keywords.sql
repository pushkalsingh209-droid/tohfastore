-- Run this in the Supabase SQL editor.
-- Per-post keyword list for blog posts (owner: "add hashtags and keywords
-- list in the blogs, written below each blog"). One column is the single
-- source of truth: plain phrases ("brass idols", "Lakshmi Ganesha"). The
-- hashtags shown under a post and in its Instagram caption are DERIVED from
-- these (app/utils/blogContent.ts keywordToHashtag), so the two lists can
-- never drift apart. Empty array = no keywords block rendered, same as every
-- post before this migration. Editable in the admin Blog tab.

alter table blog_posts
  add column if not exists keywords text[] not null default '{}';
