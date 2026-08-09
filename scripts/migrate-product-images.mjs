// scripts/migrate-product-images.mjs
// One-off batch migration: every product photo currently lives in one of
// several legacy Supabase Storage buckets (brass-images, polyresin,
// resinEarrings, PocketTemple, panStandSilver, panStand,
// brassALuminiumChess, boardGames -- named after old product categories),
// as an uncompressed jpg/png served through a 10-year signed URL. New admin
// uploads (see app/api/admin/upload/route.ts) instead land pre-compressed
// WebP in a single `brass-images` bucket. This brings every *existing*
// product photo in line with that: downloads the original, runs it through
// the same resize/WebP pipeline as the client-side compressor
// (app/utils/compressImage.ts), re-uploads to brass-images, and repoints
// each product's image_url/images[] at the new signed URL.
//
// Safe to re-run: already-migrated files are skipped (checked via the
// deterministic destination path), and the manifest tracks source
// bucket/path -> destination so the separate cleanup script
// (cleanup-legacy-product-images.mjs) knows what's now safe to delete.
//
// Usage:
//   node --env-file=.env.local scripts/migrate-product-images.mjs           (dry run)
//   node --env-file=.env.local scripts/migrate-product-images.mjs --apply   (does the work)
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = path.join(__dirname, ".image-migration-manifest.json");

const DEST_BUCKET = "brass-images";
const TEN_YEARS_SECONDS = 315360000;
const MAX_DIMENSION = 1600;
const WEBP_QUALITY = 85;

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

// Deterministic, collision-free, and idempotent: re-running the script maps
// the same source file to the same destination path, so it's cheap to skip
// what's already done.
function destPathFor(bucket, srcPath) {
  const slug = `${bucket}/${srcPath}`.replace(/[^a-zA-Z0-9._/-]/g, "_");
  const hash = crypto.createHash("sha1").update(slug).digest("hex").slice(0, 10);
  const base = path.basename(srcPath).replace(/\.[^./]+$/, "").replace(/[^a-zA-Z0-9._-]/g, "_");
  return `migrated/${base}-${hash}.webp`;
}

function loadManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) return {};
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
}
function saveManifest(manifest) {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

async function destAlreadyExists(destPath) {
  const dir = path.dirname(destPath);
  const name = path.basename(destPath);
  const { data, error } = await supabase.storage.from(DEST_BUCKET).list(dir === "." ? "" : dir);
  if (error) return false;
  return (data || []).some((f) => f.name === name);
}

async function migrateOne(bucket, srcPath) {
  const destPath = destPathFor(bucket, srcPath);

  if (await destAlreadyExists(destPath)) {
    const { data: signedData, error: signError } = await supabase.storage
      .from(DEST_BUCKET)
      .createSignedUrl(destPath, TEN_YEARS_SECONDS);
    if (signError || !signedData) throw new Error(`Re-signing existing ${destPath} failed: ${signError?.message}`);
    return { destPath, url: signedData.signedUrl, skipped: true };
  }

  const { data: original, error: downloadError } = await supabase.storage.from(bucket).download(srcPath);
  if (downloadError) throw new Error(`Download ${bucket}/${srcPath} failed: ${downloadError.message}`);

  const inputBuffer = Buffer.from(await original.arrayBuffer());
  const image = sharp(inputBuffer, { failOn: "none" });
  const metadata = await image.metadata();
  const scale = Math.min(1, MAX_DIMENSION / Math.max(metadata.width || MAX_DIMENSION, metadata.height || MAX_DIMENSION));
  const outputBuffer = await image
    .resize({
      width: Math.round((metadata.width || MAX_DIMENSION) * scale),
      height: Math.round((metadata.height || MAX_DIMENSION) * scale),
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  if (!APPLY) return { destPath, url: null, dryRun: true, bytesBefore: inputBuffer.length, bytesAfter: outputBuffer.length };

  const { error: uploadError } = await supabase.storage.from(DEST_BUCKET).upload(destPath, outputBuffer, {
    contentType: "image/webp",
    upsert: false,
  });
  if (uploadError) throw new Error(`Upload ${destPath} failed: ${uploadError.message}`);

  const { data: signedData, error: signError } = await supabase.storage
    .from(DEST_BUCKET)
    .createSignedUrl(destPath, TEN_YEARS_SECONDS);
  if (signError || !signedData) throw new Error(`Sign ${destPath} failed: ${signError?.message}`);

  return { destPath, url: signedData.signedUrl, bytesBefore: inputBuffer.length, bytesAfter: outputBuffer.length };
}

async function main() {
  console.log(APPLY ? "Running in APPLY mode -- this will write to storage and the database.\n" : "Running in DRY-RUN mode -- pass --apply to actually migrate.\n");

  const { data: products, error } = await supabase.from("products").select("id, image_url, images");
  if (error) throw error;

  const manifest = loadManifest();
  let migrated = 0, skipped = 0, failed = 0, productsUpdated = 0;
  let bytesBefore = 0, bytesAfter = 0;

  for (const product of products) {
    const urlToNewUrl = new Map();
    const urls = [product.image_url, ...(Array.isArray(product.images) ? product.images : [])].filter(Boolean);

    for (const u of urls) {
      const bp = extractBucketPath(u);
      if (!bp) {
        console.warn(`[product ${product.id}] could not parse bucket/path from: ${u}`);
        continue;
      }
      if (bp.bucket === DEST_BUCKET && bp.path.startsWith("migrated/")) continue; // already migrated

      const manifestKey = `${bp.bucket}/${bp.path}`;
      try {
        const result = await migrateOne(bp.bucket, bp.path);
        if (result.dryRun) {
          console.log(`[dry-run] ${manifestKey} -> ${result.destPath} (${result.bytesBefore}B -> ${result.bytesAfter}B)`);
        } else {
          if (result.skipped) skipped++; else migrated++;
          if (result.bytesBefore) { bytesBefore += result.bytesBefore; bytesAfter += result.bytesAfter; }
          manifest[manifestKey] = { destBucket: DEST_BUCKET, destPath: result.destPath, migratedAt: new Date().toISOString() };
          urlToNewUrl.set(u, result.url);
        }
      } catch (err) {
        failed++;
        console.error(`[product ${product.id}] FAILED ${manifestKey}: ${err.message}`);
      }
    }

    if (APPLY && urlToNewUrl.size > 0) {
      const payload = {};
      if (urlToNewUrl.has(product.image_url)) payload.image_url = urlToNewUrl.get(product.image_url);
      if (Array.isArray(product.images) && product.images.some((u) => urlToNewUrl.has(u))) {
        payload.images = product.images.map((u) => urlToNewUrl.get(u) || u);
      }
      if (Object.keys(payload).length > 0) {
        const { error: updateError } = await supabase.from("products").update(payload).eq("id", product.id);
        if (updateError) {
          failed++;
          console.error(`[product ${product.id}] DB update failed: ${updateError.message}`);
        } else {
          productsUpdated++;
        }
      }
      saveManifest(manifest);
    }
  }

  console.log("\n--- Summary ---");
  console.log(`migrated: ${migrated}, already-migrated (skipped): ${skipped}, failed: ${failed}`);
  console.log(`products updated: ${productsUpdated}`);
  if (bytesAfter > 0) {
    console.log(`size: ${(bytesBefore / 1024 / 1024).toFixed(1)}MB -> ${(bytesAfter / 1024 / 1024).toFixed(1)}MB`);
  }
  if (!APPLY) console.log("\nThis was a dry run -- nothing was written. Re-run with --apply to perform the migration.");
  else console.log(`\nManifest written to ${MANIFEST_PATH} -- used by cleanup-legacy-product-images.mjs.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
