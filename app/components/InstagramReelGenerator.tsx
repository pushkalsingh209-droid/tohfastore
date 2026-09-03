// app/components/InstagramReelGenerator.tsx
// Public "Create Insta Reel" tool -- the video counterpart to
// InstagramPostGenerator.tsx, sitting right next to it on the product page.
//
// COST: deliberately zero new server cost. It reuses the SAME already-cached
// /api/instagram-post-image PNG that tool already fetches (same origin, so
// no CORS/canvas-tainting problem) and renders the whole clip -- a Ken Burns
// push-in inside a branded vertical frame -- on a <canvas> in the visitor's
// own browser, captured with canvas.captureStream() + MediaRecorder. No new
// route, no new Supabase egress beyond what that already-cached image costs,
// no server-side video rendering (real Vercel CPU this plan can't absorb).
//
// LIABILITY: silent by design, not an oversight. Baking a licensed music
// track into a video anyone can generate and repost is a real rights
// exposure with no way to clear it per-video. The panel instead points
// people at Instagram's own trending-audio picker after upload -- which is
// also what the Reels algorithm rewards more than a fixed soundtrack would.
//
// Feature-detected: if the browser has no MediaRecorder / canvas
// captureStream (effectively no real browser left, but fail closed anyway),
// the button doesn't render at all rather than showing a tool that can't work.
"use client";
import { useEffect, useRef, useState } from "react";
import { buildInstagramCaption, type InstagramCaptionProduct } from "@/app/utils/instagramCaption";
import { BRAND_MAROON, BRAND_GOLD_LIGHT } from "@/app/utils/brandMark";

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const IMG_SIZE = 1080;
const IMG_TOP = (CANVAS_H - IMG_SIZE) / 2;
const DURATION_MS = 6000;
const FPS = 30;

const DISPLAY_FONT_FAMILY = "TohfaReelDisplay";
const DISPLAY_FONT_STACK = `"${DISPLAY_FONT_FAMILY}", Georgia, "Times New Roman", serif`;

// Reuses the exact WOFF the server-side post-image route already bundles
// (public/fonts/PlayfairDisplay-Bold.woff) -- no new asset, and the two
// tools' generated art then shares one display face. Loaded once per
// browser session (module-level cache), best-effort: a failed load just
// falls back to the Georgia stack above, never blocks rendering.
let displayFontLoaded: Promise<boolean> | null = null;
function ensureDisplayFont(): Promise<boolean> {
  if (displayFontLoaded) return displayFontLoaded;
  displayFontLoaded = (async () => {
    try {
      if (typeof FontFace === "undefined") return false;
      const font = new FontFace(DISPLAY_FONT_FAMILY, "url(/fonts/PlayfairDisplay-Bold.woff)", { weight: "700" });
      await font.load();
      document.fonts.add(font);
      return true;
    } catch {
      return false;
    }
  })();
  return displayFontLoaded;
}

function pickMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
  for (const type of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(type)) return type;
    } catch {
      // isTypeSupported can itself throw on very old implementations.
    }
  }
  return ""; // MediaRecorder exists but none of our candidates matched -- let it pick its own default.
}

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function wrapCenteredText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
}

// Pure draw so the exact same function drives both the looping idle preview
// and the one-shot recorded pass -- what's previewed is what gets recorded,
// not a second approximation of it.
function drawFrame(ctx: CanvasRenderingContext2D, img: HTMLImageElement, elapsedMs: number, productName: string) {
  const t = Math.min(1, elapsedMs / DURATION_MS);
  const scale = 1 + easeInOutQuad(t) * 0.12;
  const fadeIn = Math.min(1, elapsedMs / 350);

  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // Same three-stop maroon gradient as the order-confirmation email header
  // -- this reads as the same brand, not a new one invented for the reel.
  const bg = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H);
  bg.addColorStop(0, "#241010");
  bg.addColorStop(0.55, "#481416");
  bg.addColorStop(1, BRAND_MAROON);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.save();
  ctx.globalAlpha = fadeIn;

  // Ken Burns push-in on the product photo, clipped to its own frame.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, IMG_TOP, IMG_SIZE, IMG_SIZE);
  ctx.clip();
  const cx = IMG_SIZE / 2;
  const cy = IMG_TOP + IMG_SIZE / 2;
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);
  ctx.drawImage(img, 0, IMG_TOP, IMG_SIZE, IMG_SIZE);
  ctx.restore();

  ctx.strokeStyle = BRAND_GOLD_LIGHT;
  ctx.lineWidth = 10;
  ctx.strokeRect(5, IMG_TOP + 5, IMG_SIZE - 10, IMG_SIZE - 10);

  ctx.textAlign = "center";
  ctx.fillStyle = BRAND_GOLD_LIGHT;
  ctx.font = `700 60px ${DISPLAY_FONT_STACK}`;
  ctx.fillText("TOHFA", CANVAS_W / 2, 230);
  ctx.fillStyle = "#d9c9ab";
  ctx.font = `400 26px "Work Sans", -apple-system, sans-serif`;
  ctx.fillText("Crafted Traditions. Timeless Gifts.", CANVAS_W / 2, 275);

  ctx.fillStyle = "#f4e8d0";
  ctx.font = `700 44px ${DISPLAY_FONT_STACK}`;
  wrapCenteredText(ctx, productName, CANVAS_W / 2, IMG_TOP + IMG_SIZE + 110, CANVAS_W - 160, 52);
  ctx.fillStyle = "#d9c9ab";
  ctx.font = `400 26px "Work Sans", -apple-system, sans-serif`;
  ctx.fillText("tohfaonline.com", CANVAS_W / 2, CANVAS_H - 90);

  ctx.restore();
}

type Status = "idle" | "loading" | "ready" | "recording" | "done" | "error";

export default function InstagramReelGenerator({ product }: { product: InstagramCaptionProduct }) {
  const [open, setOpen] = useState(false);
  const [supported, setSupported] = useState(true);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoExt, setVideoExt] = useState("webm");
  const [caption, setCaption] = useState(() => buildInstagramCaption(product));

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const previewRafRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    setSupported(
      typeof MediaRecorder !== "undefined" &&
      typeof HTMLCanvasElement !== "undefined" &&
      "captureStream" in HTMLCanvasElement.prototype
    );
  }, []);

  function startPreviewLoop() {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const start = performance.now();
    const loop = (now: number) => {
      const elapsed = (now - start) % DURATION_MS;
      drawFrame(ctx, img, elapsed, product.name || "this piece");
      previewRafRef.current = requestAnimationFrame(loop);
    };
    previewRafRef.current = requestAnimationFrame(loop);
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    setStatus("loading");
    setVideoUrl(null);
    setCaption(buildInstagramCaption(product));
    setCopied(false);

    (async () => {
      await ensureDisplayFont();
      const res = await fetch(`/api/instagram-post-image?id=${product.id}`);
      if (!res.ok) throw new Error("image fetch failed");
      const blob = await res.blob();
      objectUrl = URL.createObjectURL(blob);
      const img = new Image();
      img.src = objectUrl;
      await img.decode();
      if (cancelled) return;
      imgRef.current = img;
      setStatus("ready");
      startPreviewLoop();
    })().catch(() => {
      if (!cancelled) setStatus("error");
    });

    return () => {
      cancelled = true;
      if (previewRafRef.current) cancelAnimationFrame(previewRafRef.current);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product.id]);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  function handleOpen() {
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
    if (previewRafRef.current) cancelAnimationFrame(previewRafRef.current);
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
  }

  function handleCopyCaption() {
    navigator.clipboard?.writeText(caption).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  function handleRecord() {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || typeof canvas.captureStream !== "function") {
      setStatus("error");
      return;
    }
    const ctx = canvas.getContext("2d");
    const mimeType = pickMimeType();
    if (!ctx || mimeType === null) {
      setStatus("error");
      return;
    }
    if (previewRafRef.current) cancelAnimationFrame(previewRafRef.current);

    const stream = canvas.captureStream(FPS);
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    recorderRef.current = recorder;
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      const actualType = recorder.mimeType || mimeType || "video/webm";
      setVideoExt(actualType.includes("mp4") ? "mp4" : "webm");
      setVideoUrl(URL.createObjectURL(new Blob(chunks, { type: actualType })));
      setStatus("done");
    };

    setStatus("recording");
    setProgress(0);
    recorder.start();

    const start = performance.now();
    const step = (now: number) => {
      const elapsed = now - start;
      drawFrame(ctx, img, elapsed, product.name || "this piece");
      setProgress(Math.min(100, Math.round((elapsed / DURATION_MS) * 100)));
      if (elapsed < DURATION_MS) {
        requestAnimationFrame(step);
      } else if (recorder.state !== "inactive") {
        recorder.stop();
      }
    };
    requestAnimationFrame(step);
  }

  function handleRecordAgain() {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null);
    setStatus("ready");
    startPreviewLoop();
  }

  if (!supported) return null;

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="w-full flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold border border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 px-3 py-2 rounded transition"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
        Create Insta Reel
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/40 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Create an Instagram reel"
          onClick={handleClose}
        >
          <div
            className="w-full sm:max-w-md bg-white dark:bg-stone-900 rounded-t-2xl sm:rounded-xl shadow-xl max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 p-4 sm:p-5 border-b border-stone-200 dark:border-stone-800">
              <h3 className="text-base font-serif font-bold text-stone-900 dark:text-stone-100">Create an Instagram reel</h3>
              <button type="button" onClick={handleClose} aria-label="Close" className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 text-xl leading-none">
                &times;
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              <div
                className="relative w-full mx-auto rounded-lg border border-stone-200 dark:border-stone-800 overflow-hidden bg-stone-100 dark:bg-stone-950"
                style={{ maxWidth: 260, aspectRatio: "9 / 16" }}
              >
                {videoUrl ? (
                  <video src={videoUrl} controls autoPlay loop muted playsInline className="w-full h-full object-cover" />
                ) : (
                  <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} className="w-full h-full" />
                )}
                {status === "loading" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-xs">Loading photo&hellip;</div>
                )}
                {status === "recording" && (
                  <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/30">
                    <div className="h-full bg-amber-500" style={{ width: `${progress}%` }} />
                  </div>
                )}
              </div>

              {status === "error" && (
                <p className="text-xs text-red-600 dark:text-red-400 text-center">
                  Couldn&rsquo;t generate a preview just now &mdash; try again in a moment.
                </p>
              )}

              <p className="text-xs text-stone-500 dark:text-stone-400 text-center">
                6-second clip, no sound. For reach, add a trending audio track from Instagram&rsquo;s own picker
                after you upload &mdash; that&rsquo;s what the algorithm favours anyway.
              </p>

              <div>
                <label htmlFor="tohfa-reel-caption" className="block text-[11px] uppercase tracking-wider font-semibold text-stone-500 dark:text-stone-400 mb-1">
                  Caption (edit before you post, if you like)
                </label>
                <textarea
                  id="tohfa-reel-caption"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 rounded border border-stone-300 dark:border-stone-700 text-xs sm:text-sm bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none focus:border-amber-600 resize-y"
                />
              </div>
            </div>

            <div className="flex gap-2 p-4 sm:p-5 border-t border-stone-200 dark:border-stone-800 sticky bottom-0 bg-white dark:bg-stone-900">
              <button
                type="button"
                onClick={handleCopyCaption}
                className="flex-1 py-2.5 rounded border border-stone-300 dark:border-stone-700 text-sm font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition"
              >
                {copied ? "Caption Copied!" : "Copy Caption"}
              </button>
              {videoUrl ? (
                <a
                  href={videoUrl}
                  download={`tohfa-reel-${product.id}.${videoExt}`}
                  className="flex-1 py-2.5 rounded bg-stone-950 dark:bg-amber-700 text-white text-sm font-semibold hover:bg-amber-800 dark:hover:bg-amber-600 transition text-center"
                >
                  Download Video
                </a>
              ) : (
                <button
                  type="button"
                  onClick={handleRecord}
                  disabled={status !== "ready" && status !== "recording"}
                  className="flex-1 py-2.5 rounded bg-stone-950 dark:bg-amber-700 text-white text-sm font-semibold hover:bg-amber-800 dark:hover:bg-amber-600 transition text-center disabled:opacity-50"
                >
                  {status === "recording" ? `Recording… ${progress}%` : "Record & Download"}
                </button>
              )}
            </div>
            {videoUrl && (
              <div className="px-4 sm:px-5 pb-4 sm:pb-5 -mt-2">
                <button
                  type="button"
                  onClick={handleRecordAgain}
                  className="w-full text-xs text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 underline"
                >
                  Record again
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
