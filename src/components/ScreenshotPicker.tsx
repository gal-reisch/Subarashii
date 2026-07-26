"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { addFromScreenshotsAction } from "@/app/actions";
import { buttonClass } from "@/components/Button";

// Long edge, in px, that each screenshot is downscaled to before upload.
// Gemini reads phone-screenshot-sized text comfortably at this resolution,
// and it keeps a 6-image import inside the Server Action body limit (see
// next.config.ts) instead of posting 4MB originals.
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;
const MAX_IMAGES = 8;

interface Shot {
  /** Base64 (no data: prefix) — what the Gemini REST API wants inline. */
  data: string;
  /** Full data URL, for the thumbnail. */
  preview: string;
}

export function ScreenshotPicker() {
  const [shots, setShots] = useState<Shot[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    // Reset the input so re-picking the same file still fires a change event.
    if (inputRef.current) inputRef.current.value = "";
    if (files.length === 0) return;

    setBusy(true);
    setError(null);
    const added: Shot[] = [];
    for (const file of files) {
      if (shots.length + added.length >= MAX_IMAGES) break;
      try {
        added.push(await downscale(file));
      } catch {
        // One unreadable file (an odd HEIC variant, a corrupt download)
        // shouldn't discard the ones that did decode.
        setError(`Couldn't read ${file.name}. Try a PNG or JPEG screenshot.`);
      }
    }
    setShots((prev) => [...prev, ...added].slice(0, MAX_IMAGES));
    setBusy(false);
  }

  function remove(i: number) {
    setShots((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <form action={addFromScreenshotsAction} className="flex flex-col gap-3">
      {shots.map((s, i) => (
        <input key={i} type="hidden" name="image" value={s.data} />
      ))}

      <label className="font-heading text-[17px] font-semibold text-foreground">
        Screenshots
      </label>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={onPick}
        className="rounded-[10px] border border-accent bg-white px-4 py-3.5 text-sm outline-none shadow-[0px_10px_40px_0px_rgba(0,0,0,0.03)] file:mr-3 file:rounded-full file:border-0 file:bg-accent file:px-4 file:py-1.5 file:font-heading file:text-sm file:font-semibold file:text-accent-ink"
      />

      <p className="text-xs text-muted">
        Screenshot the whole recipe — ingredients and steps, across as many
        shots as it takes. They&apos;re read in the order you add them.
      </p>

      {shots.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {shots.map((s, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.preview}
                alt={`Screenshot ${i + 1}`}
                className="h-24 w-20 rounded-xl object-cover shadow-[0px_4px_14px_rgba(0,0,0,0.08)]"
              />
              <span className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent font-mono text-[10px] font-medium text-accent-ink">
                {i + 1}
              </span>
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`Remove screenshot ${i + 1}`}
                className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-card text-sm shadow-[0px_4px_14px_rgba(0,0,0,0.15)] active:scale-90"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {busy && <p className="text-xs text-muted">Preparing images…</p>}
      {error && <p className="text-xs text-warn-text">{error}</p>}

      <SubmitButton disabled={shots.length === 0 || busy} />
    </form>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={buttonClass(disabled ? "secondary" : "primary")}
    >
      {pending ? "Reading the recipe…" : "Read recipe from screenshots"}
    </button>
  );
}

// Decode -> fit inside MAX_EDGE -> re-encode as JPEG. Done on the client so
// the network only ever carries the downscaled version.
async function downscale(file: File): Promise<Shot> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  // Screenshots often have transparent regions; without a white backdrop
  // those become black in JPEG and swallow dark text.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const preview = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  return { preview, data: preview.slice(preview.indexOf(",") + 1) };
}
