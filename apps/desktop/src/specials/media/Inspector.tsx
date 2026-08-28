import { Film, Link, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import type { SpecialInspectorProps } from "../types";
import { defaultMediaConfig, type MediaConfig, type MediaFit } from "./config";

const MAX_MEDIA_BYTES = 12 * 1024 * 1024;

export function MediaInspector({ config, onChange }: SpecialInspectorProps<MediaConfig>) {
  const current = { ...defaultMediaConfig, ...config };
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(current.source.startsWith("data:") ? "" : current.source);
  const [error, setError] = useState<string | null>(null);

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    const isImage = file.type.startsWith("image/");
    const isMp4 = file.type === "video/mp4" || file.name.toLowerCase().endsWith(".mp4");
    if (!isImage && !isMp4) {
      setError("Choose an MP4 or image file.");
      return;
    }
    if (file.size > MAX_MEDIA_BYTES) {
      setError("Keep uploaded media under 12 MB, or use a URL.");
      return;
    }
    try {
      const source = await readDataUrl(file);
      setUrl("");
      onChange({ ...current, source, fileName: file.name, mediaType: isImage ? "image" : "video" });
    } catch {
      setError("Could not read that file.");
    }
  };

  const applyUrl = () => {
    const source = url.trim();
    if (!source) return;
    const clean = source.split(/[?#]/, 1)[0]?.toLowerCase() ?? "";
    onChange({ ...current, source, fileName: source, mediaType: isImagePath(clean) ? "image" : "video" });
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="chrome-label mb-2">Media</p>
        <input ref={fileRef} type="file" accept=".mp4,.gif,.png,.jpg,.jpeg,.webp,.avif,.bmp,.svg,video/mp4,image/*" className="hidden"
          onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; void pickFile(file); }} />
        <div className="flex gap-1.5">
          <button type="button" onClick={() => fileRef.current?.click()}
            className="flex h-9 min-w-0 flex-1 items-center justify-center gap-2 border border-white/15 px-2 text-[13px] text-white hover:bg-white/10">
            <Upload className="size-3.5 shrink-0" />
            <span className="truncate">{current.fileName || "Upload media"}</span>
          </button>
          {current.source ? <button type="button" title="Remove media" onClick={() => onChange({ ...current, source: "", fileName: "" })}
            className="flex size-9 items-center justify-center border border-white/15 text-white/70 hover:bg-white/10"><X className="size-3.5" /></button> : null}
        </div>
        {error ? <p className="mt-1.5 text-[12px] text-danger">{error}</p> : null}
      </div>

      <div className="space-y-1.5">
        <span className="chrome-label">Media URL</span>
        <div className="flex gap-1.5">
          <input value={url} onChange={(event) => setUrl(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") applyUrl(); }}
            placeholder="https://…/clip.mp4" className="panel-field no-drag h-9 min-w-0 flex-1 px-2 text-[12px] outline-none" />
          <button type="button" title="Use URL" onClick={applyUrl} className="flex size-9 items-center justify-center border border-white/15 text-white/70 hover:bg-white/10"><Link className="size-3.5" /></button>
        </div>
      </div>

      <div>
        <p className="chrome-label mb-2">Fit</p>
        <div className="grid grid-cols-3 gap-1.5">
          {(["cover", "contain", "fill"] as MediaFit[]).map((fit) => <button key={fit} type="button" onClick={() => onChange({ ...current, fit })}
            className={`h-9 border text-[11px] uppercase tracking-wider ${current.fit === fit ? "border-accent bg-accent/15 text-white" : "border-white/10 text-white/50 hover:text-white"}`}>{fit}</button>)}
        </div>
      </div>

      {current.mediaType === "video" ? <div className="space-y-2 border border-white/10 bg-white/[0.025] p-3">
        <Toggle label="Autoplay" checked={current.autoplay} onChange={(autoplay) => onChange({ ...current, autoplay })} />
        <Toggle label="Loop" checked={current.loop} onChange={(loop) => onChange({ ...current, loop })} />
        <Toggle label="Muted" checked={current.muted} onChange={(muted) => onChange({ ...current, muted })} />
      </div> : null}

      <p className="flex gap-2 text-[12px] leading-relaxed text-white/40"><Film className="mt-0.5 size-3.5 shrink-0" />Supports MP4, GIF, PNG, JPEG, WebP, AVIF, BMP, and SVG. MP4 autoplay works most reliably when muted.</p>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex items-center justify-between gap-3 text-[12px] text-white/65"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="no-drag size-4 accent-accent" /></label>;
}

function readDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read file"));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function isImagePath(path: string) {
  return /\.(gif|png|jpe?g|webp|avif|bmp|svg)$/.test(path);
}
