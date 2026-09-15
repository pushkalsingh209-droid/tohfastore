// app/components/BlogPhotoPicker.tsx
// A grid of upload slots backing /blog/submit's cover photo (slots=1) and
// gallery (slots=4) fields. Each empty slot is its own tap target -- better
// for a phone (this form is mobile-first) than one shared "add" button that
// keeps re-triggering for every photo. Compresses in-browser (same
// compressImageFile already used by the admin's ImageUploadField) before
// POSTing to /api/blog/upload-photo, so a photo straight off a phone camera
// doesn't upload at full resolution over a slow connection.
"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import { compressImageFile } from "@/app/utils/compressImage";

export default function BlogPhotoPicker({
  value,
  onChange,
  slots,
  label,
  disabled,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  slots: number;
  label: string;
  disabled?: boolean;
}) {
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [error, setError] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  async function handleFile(index: number, file: File | undefined) {
    if (!file) return;
    setError("");
    setUploadingIndex(index);
    try {
      let uploadFile: File = file;
      try {
        uploadFile = await compressImageFile(file);
      } catch {
        // Compression is a nice-to-have -- fall back to the original.
      }
      const body = new FormData();
      body.append("file", uploadFile);
      const res = await fetch("/api/blog/upload-photo", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Upload failed.");
      const next = [...value];
      next[index] = data.url;
      onChange(next.filter(Boolean));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploadingIndex(null);
      const el = inputRefs.current[index];
      if (el) el.value = "";
    }
  }

  function handleRemove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div>
      <label className="block text-xs font-semibold text-fg mb-2">{label}</label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: slots }).map((_, i) => {
          const url = value[i];
          const uploading = uploadingIndex === i;
          if (url) {
            return (
              <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-surface-2 border border-border">
                <Image src={url} alt="" fill sizes="150px" className="object-cover" />
                <button
                  type="button"
                  onClick={() => handleRemove(i)}
                  disabled={disabled}
                  aria-label="Remove photo"
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-scrim/70 text-white flex items-center justify-center text-sm leading-none"
                >
                  &times;
                </button>
              </div>
            );
          }
          return (
            <label
              key={i}
              className={`aspect-square rounded-lg border-2 border-dashed flex items-center justify-center text-center px-2 transition ${
                disabled || uploading
                  ? "border-border text-faint cursor-not-allowed"
                  : "border-border-strong text-muted hover:border-accent-soft-border hover:text-accent cursor-pointer"
              }`}
            >
              <span className="text-[11px] uppercase tracking-wider font-semibold">
                {uploading ? "Uploading..." : "+ Add Photo"}
              </span>
              <input
                ref={(el) => {
                  inputRefs.current[i] = el;
                }}
                type="file"
                accept="image/*"
                disabled={disabled || uploading}
                onChange={(e) => handleFile(i, e.target.files?.[0])}
                className="hidden"
              />
            </label>
          );
        })}
      </div>
      {error && <p className="text-[11px] text-danger mt-1.5">{error}</p>}
    </div>
  );
}
