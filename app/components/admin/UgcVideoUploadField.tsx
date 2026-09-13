// app/components/admin/UgcVideoUploadField.tsx
// Attaches a video to a #TOHFACRAFTS UGC submission (IMPROVEMENTS.md #9)
// via /api/admin/ugc/upload-video. Similar shape to ImageUploadField.tsx
// (paired URL field + file-picker), but `onChange` here PATCHes the server
// immediately (there's no surrounding form + Save button in the UGC
// moderation row, unlike the product form ImageUploadField lives in) -- so
// unlike that field, the manual URL text box only commits on blur, not on
// every keystroke; a completed file upload still commits immediately, since
// that's a single, already-final value. No client-side compression step --
// unlike a product photo there's no cheap in-browser video re-encode, so
// the file goes up as-is (the route's own 25MB cap is the guard). The URL
// field also accepts a direct video file link pasted from elsewhere (not a
// YouTube/Instagram page -- a plain .mp4/.webm URL only, since it's
// rendered with a bare <video> tag, not an embed).
"use client";
import { useRef, useState } from "react";

export default function UgcVideoUploadField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the draft in sync if the committed value changes from elsewhere
  // (e.g. a fresh admin data load) while the admin isn't mid-edit -- derived
  // during render (React's documented "adjusting state when a prop changes"
  // pattern) rather than an effect, so this doesn't cost an extra render pass.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(value);
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/admin/ugc/upload-video", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Upload failed.");
      setDraft(data.url);
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
          disabled={disabled}
          placeholder="Video URL (.mp4/.webm) -- or upload a file"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft.trim() !== value) onChange(draft.trim());
          }}
          className="flex-grow px-3 py-2 rounded border border-border-strong text-xs focus:outline-none focus:border-accent bg-surface-2"
        />
        <label
          className={`flex items-center px-3 py-2 rounded border text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap transition ${
            disabled || uploading
              ? "border-border text-faint cursor-not-allowed"
              : "border-accent-soft-border text-accent hover:bg-accent-soft cursor-pointer"
          }`}
        >
          {uploading ? "Uploading..." : "Upload"}
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
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
