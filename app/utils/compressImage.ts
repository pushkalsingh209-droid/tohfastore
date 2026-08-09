// app/utils/compressImage.ts
"use client";
// Downscales + re-encodes a product photo in the browser before it's
// uploaded from the admin panel (see app/components/admin/ImageUploadField.tsx).
// next.config.ts currently forces images.unoptimized=true (Vercel Image
// Optimization quota safety net), so nothing resizes/reformats product
// photos server-side anymore -- every visitor downloads exactly what got
// uploaded here. Doing it client-side, once, at upload time is the
// replacement for that lost step.
const MAX_DIMENSION = 1600;
const WEBP_QUALITY = 0.85;

export async function compressImageFile(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", WEBP_QUALITY));
    if (!blob) return file;

    const baseName = file.name.replace(/\.[^./]+$/, "");
    return new File([blob], `${baseName}.webp`, { type: "image/webp" });
  } finally {
    bitmap.close();
  }
}
