import { Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import type { SpecialInspectorProps } from "../types";
import { defaultDitheredMediaConfig, type DitherAlgorithm, type DitheredMediaConfig, type DitherPalette } from "./config";

const MAX_MEDIA_BYTES = 12 * 1024 * 1024;
const ALGORITHMS: { id: DitherAlgorithm; label: string }[] = [{ id: "atkinson", label: "Atkinson" }, { id: "floyd-steinberg", label: "Floyd–Steinberg" }, { id: "bayer", label: "Bayer 4×4" }, { id: "threshold", label: "Hard threshold" }];
const PALETTES: { id: DitherPalette; label: string }[] = [{ id: "mono", label: "Paper" }, { id: "amber", label: "Amber" }, { id: "cyan", label: "Cyan" }, { id: "magenta", label: "Magenta" }, { id: "rgb", label: "RGB" }];

export function DitheredMediaInspector({ config, onChange }: SpecialInspectorProps<DitheredMediaConfig>) {
  const current = { ...defaultDitheredMediaConfig, ...config };
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(current.source.startsWith("data:") ? "" : current.source);
  const [error, setError] = useState<string | null>(null);
  const pick = async (file?: File) => {
    if (!file) return; setError(null);
    const gif = file.type === "image/gif" || file.name.toLowerCase().endsWith(".gif");
    const image = file.type.startsWith("image/");
    const mp4 = file.type === "video/mp4" || file.name.toLowerCase().endsWith(".mp4");
    if (!image && !mp4) { setError("Choose an MP4 or image file."); return; }
    if (file.size > MAX_MEDIA_BYTES) { setError("Keep uploads under 12 MB, or use a URL."); return; }
    try { onChange({ ...current, source: await readDataUrl(file), fileName: file.name, mediaType: gif ? "gif" : image ? "image" : "video" }); setUrl(""); }
    catch { setError("Could not read that file."); }
  };
  const applyUrl = () => { const source = url.trim(); if (!source) return; const clean = source.split(/[?#]/, 1)[0]?.toLowerCase() ?? ""; onChange({ ...current, source, fileName: source, mediaType: clean.endsWith(".gif") ? "gif" : isImagePath(clean) ? "image" : "video" }); };
  return <div className="space-y-4">
    <div><p className="chrome-label mb-2">Media</p><input ref={inputRef} type="file" accept=".mp4,.gif,.png,.jpg,.jpeg,.webp,.avif,.bmp,.svg,video/mp4,image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; void pick(file); }} />
      <div className="flex gap-1.5"><button type="button" onClick={() => inputRef.current?.click()} className="flex h-9 min-w-0 flex-1 items-center justify-center gap-2 border border-white/15 px-2 text-[13px] text-white hover:bg-white/10"><Upload className="size-3.5" /><span className="truncate">{current.fileName || "Upload media"}</span></button>{current.source ? <button type="button" onClick={() => onChange({ ...current, source: "", fileName: "" })} className="flex size-9 items-center justify-center border border-white/15 text-white/70"><X className="size-3.5" /></button> : null}</div>{error ? <p className="mt-1.5 text-[12px] text-danger">{error}</p> : null}</div>
    <label className="block space-y-1.5"><span className="chrome-label">Media URL</span><div className="flex gap-1.5"><input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") applyUrl(); }} placeholder="https://…/clip.mp4" className="panel-field no-drag h-9 min-w-0 flex-1 px-2 text-[12px] outline-none" /><button type="button" onClick={applyUrl} className="h-9 border border-white/15 px-3 text-[11px] uppercase text-white/65">Use</button></div></label>
    <Select label="Algorithm" value={current.algorithm} items={ALGORITHMS} onChange={(algorithm) => onChange({ ...current, algorithm: algorithm as DitherAlgorithm })} />
    <Select label="Palette" value={current.palette} items={PALETTES} onChange={(palette) => onChange({ ...current, palette: palette as DitherPalette })} />
    <Range label="Pixel size" value={current.pixelSize} min={1} max={12} step={1} display={`${current.pixelSize}px`} onChange={(pixelSize) => onChange({ ...current, pixelSize })} />
    <Range label="Threshold" value={current.threshold} min={0} max={255} step={1} onChange={(threshold) => onChange({ ...current, threshold })} />
    <Range label="Contrast" value={current.contrast} min={0.5} max={2.5} step={0.05} display={`${current.contrast.toFixed(2)}×`} onChange={(contrast) => onChange({ ...current, contrast })} />
    <div className="grid grid-cols-2 gap-1.5">{(["cover", "contain", "fill"] as const).map((fit) => <button key={fit} type="button" onClick={() => onChange({ ...current, fit })} className={`h-9 border text-[11px] uppercase ${current.fit === fit ? "border-accent bg-accent/15 text-white" : "border-white/10 text-white/50"}`}>{fit}</button>)}<button type="button" onClick={() => onChange({ ...current, invert: !current.invert })} className={`h-9 border text-[11px] uppercase ${current.invert ? "border-accent bg-accent/15 text-white" : "border-white/10 text-white/50"}`}>Invert</button></div>
    {current.mediaType === "video" ? <div className="space-y-2 border border-white/10 p-3"><Toggle label="Autoplay" checked={current.autoplay} onChange={(autoplay) => onChange({ ...current, autoplay })} /><Toggle label="Loop" checked={current.loop} onChange={(loop) => onChange({ ...current, loop })} /><Toggle label="Muted" checked={current.muted} onChange={(muted) => onChange({ ...current, muted })} /></div> : null}
    <p className="text-[12px] leading-relaxed text-white/40">Atkinson gives a crisp Macintosh look; Floyd–Steinberg is smoother; Bayer makes an ordered print texture.</p>
  </div>;
}

function Select({ label, value, items, onChange }: { label: string; value: string; items: { id: string; label: string }[]; onChange: (value: string) => void }) { return <label className="block space-y-1.5"><span className="chrome-label">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="panel-field no-drag h-9 w-full px-2 text-[12px] outline-none">{items.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>; }
function Range({ label, value, min, max, step, display, onChange }: { label: string; value: number; min: number; max: number; step: number; display?: string; onChange: (value: number) => void }) { return <label className="block"><span className="mb-1 flex justify-between"><span className="chrome-label">{label}</span><span className="font-mono text-[10px] text-white/40">{display ?? value}</span></span><input type="range" value={value} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} className="no-drag h-7 w-full accent-accent" /></label>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex items-center justify-between text-[12px] text-white/65"><span>{label}</span><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="no-drag size-4 accent-accent" /></label>; }
function readDataUrl(file: File) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error()); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); }); }
function isImagePath(path: string) { return /\.(gif|png|jpe?g|webp|avif|bmp|svg)$/.test(path); }
