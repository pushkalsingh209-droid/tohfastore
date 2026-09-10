// app/components/admin/ImageUploadField.tsx
"use client";
import { useRef, useState } from "react";
import { compressImageFile } from "@/app/utils/compressImage";

// Pairs a manual URL field (still needed for existing products, and for
// pasting a URL from elsewhere) with a file-picker that compresses the
// photo in-browser and uploads it via /api/admin/upload, then fills the URL
// field in with the result -- so most admin edits never need to touch a URL
// by hand at all.
export default function ImageUploadField({
  value,
  onChange,
  disabled,
  required,
  placeholder,
}: {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      let uploadFile: File = file;
      try {
        uploadFile = await compressImageFile(file);
      } catch {
        // Compression is a nice-to-have -- fall back to uploading the
        // original rather than blocking the upload entirely.
      }
      const body = new FormData();
      body.append("file", uploadFile);
      const res = await fetch("/api/admin/upload", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Upload failed.");
      onChange(data.url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          type="url"
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-grow px-4 py-3 rounded border border-border-strong text-sm focus:outline-none focus:border-accent bg-surface-2"
        />
        <label
          className={`flex items-center px-3 py-3 rounded border text-xs font-semibold uppercase tracking-wider whitespace-nowrap transition ${
            disabled || uploading
              ? "border-border text-faint cursor-not-allowed"
              : "border-accent-soft-border text-accent hover:bg-accent-soft cursor-pointer"
          }`}
        >
          {uploading ? "Uploading..." : "Upload"}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            disabled={disabled || uploading}
            onChange={(e) => handleFile(e.target.files?.[0])}
            className="hidden"
          />
        </label>
      </div>
      {error && <p className="text-[11px] text-danger mt-1">{error}</p>}
    </div>
  );
}
