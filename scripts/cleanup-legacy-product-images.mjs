// scripts/cleanup-legacy-product-images.mjs
// Second half of the image migration (see migrate-product-images.mjs):
// deletes the original files from their legacy buckets once every product
// has been confirmed to point at its new brass-images/migrated/... copy.
// Deliberately a separate, manually-triggered step -- run this only after
// verifying the live site renders correctly with the migrated images, since
// storage deletion can't be undone.
//
// Re-checks the *current* products table (not just the migration manifest)
// before deleting anything, so a product edited back to an old URL after
// migration won't have its image pulled out from under it.
//
// Usage:
//   node --env-file=.env.local scripts/cleanup-legacy-product-images.mjs           (dry run)
//   node --env-file=.env.local scripts/cleanup-legacy-product-images.mjs --apply   (deletes)
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = path.join(__dirname, ".image-migration-manifest.json");

const APPLY = process.argv.includes("--apply");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Run with --env-file=.env.local.");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, serviceRoleKey);

function extractBucketPath(u) {
  try {
    const url = new URL(u);
    const m = url.pathname.match(/\/object\/(?:sign|public)\/([^/]+)\/(.+)$/);
    if (!m) return null;
    return { bucket: m[1], path: decodeURIComponent(m[2]) };
  } catch {
    return null;
  }
}

async function main() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`No manifest found at ${MANIFEST_PATH}. Run migrate-product-images.mjs --apply first.`);
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  const manifestEntries = Object.entries(manifest); // "bucket/path" -> { destBucket, destPath, migratedAt }

  console.log(APPLY ? "Running in APPLY mode -- this will permanently delete storage objects.\n" : "Running in DRY-RUN mode -- pass --apply to actually delete.\n");
  console.log(`${manifestEntries.length} migrated file(s) in the manifest.`);

  const { data: products, error } = await supabase.from("products").select("id, image_url, images");
  if (error) throw error;

  const stillReferenced = new Set(); // "bucket/path"
  for (const product of products) {
    const urls = [product.image_url, ...(Array.isArray(product.images) ? product.images : [])].filter(Boolean);
    for (const u of urls) {
      const bp = extractBucketPath(u);
      if (bp) stillReferenced.add(`${bp.bucket}/${bp.path}`);
    }
  }

  const toDelete = manifestEntries.filter(([key]) => !stillReferenced.has(key));
  const stillInUse = manifestEntries.filter(([key]) => stillReferenced.has(key));

  if (stillInUse.length > 0) {
    console.log(`\n${stillInUse.length} migrated file(s) are still referenced by a product (edited back, or migration DB update didn't land) -- leaving these alone:`);
    for (const [key] of stillInUse) console.log(`  keep: ${key}`);
  }

  console.log(`\n${toDelete.length} legacy file(s) are safe to delete:`);
  const byBucket = new Map();
  for (const [key] of toDelete) {
    const [bucket, ...rest] = key.split("/");
    const p = rest.join("/");
    console.log(`  delete: ${key}`);
    if (!byBucket.has(bucket)) byBucket.set(bucket, []);
    byBucket.get(bucket).push(p);
  }

  if (!APPLY) {
    console.log("\nThis was a dry run -- nothing was deleted. Re-run with --apply to delete the files listed above.");
    return;
  }

  let deleted = 0, failed = 0;
  const survivingManifest = { ...manifest };
  for (const [bucket, paths] of byBucket) {
    const { data, error: removeError } = await supabase.storage.from(bucket).remove(paths);
    if (removeError) {
      failed += paths.length;
      console.error(`Failed to delete from ${bucket}: ${removeError.message}`);
      continue;
    }
    deleted += (data || []).length;
    for (const p of paths) delete survivingManifest[`${bucket}/${p}`];
  }
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(survivingManifest, null, 2));

  console.log(`\n--- Summary ---`);
  console.log(`deleted: ${deleted}, failed: ${failed}, kept (still referenced): ${stillInUse.length}`);
  console.log("\nThe legacy buckets themselves (now likely empty) can be removed from the Supabase dashboard if you want -- this script only deletes files, not buckets.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
