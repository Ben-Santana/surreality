import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { hsvToRgb, rgbToHsv } from "../color";
import { hexFromRgba, rgbaFromHex } from "../geometry";
import type { Rgba } from "../types";

type Props = {
  color: Rgba;
  onChange: (color: Rgba) => void;
  compact?: boolean;
};

function clamp(value: number, min = 0, max = 255) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function localUnit(event: ReactPointerEvent<HTMLDivElement>) {
  const target = event.currentTarget;
  const width = target.offsetWidth || 1;
  const height = target.offsetHeight || 1;
  return {
    x: Math.max(0, Math.min(1, event.nativeEvent.offsetX / width)),
    y: Math.max(0, Math.min(1, event.nativeEvent.offsetY / height)),
  };
}

export default function ColorPicker({ color, onChange, compact = false }: Props) {
  const hsv = rgbToHsv(color.r, color.g, color.b);
  const svRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<"sv" | "hue" | "alpha" | null>(null);

  const setHsv = (h: number, s: number, v: number, alpha = color.a) => {
    onChange({ ...hsvToRgb(h, s, v), a: alpha });
  };

  useEffect(() => {
    const prevent = (event: WheelEvent) => event.stopPropagation();
    svRef.current?.addEventListener("wheel", prevent);
    return () => svRef.current?.removeEventListener("wheel", prevent);
  }, []);

  const hueColor = hsvToRgb(hsv.h, 1, 1);

  return (
    <div className="space-y-3" data-no-drag>
      <div
        ref={svRef}
        className={`relative w-full overflow-hidden rounded-none ${compact ? "h-24" : "h-32"}`}
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, rgb(${hueColor.r}, ${hueColor.g}, ${hueColor.b}))`,
        }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          dragging.current = "sv";
          const { x, y } = localUnit(event);
          setHsv(hsv.h, x, 1 - y);
        }}
        onPointerMove={(event) => {
          if (dragging.current !== "sv") return;
          const { x, y } = localUnit(event);
          setHsv(hsv.h, x, 1 - y);
        }}
        onPointerUp={() => {
          dragging.current = null;
        }}
      >
        <div
          className="pointer-events-none absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-none border-2 border-white shadow"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
        />
      </div>

      <div
        className="relative h-3 w-full rounded-none"
        style={{
          background:
            "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
        }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          dragging.current = "hue";
          setHsv(localUnit(event).x * 360, hsv.s, hsv.v);
        }}
        onPointerMove={(event) => {
          if (dragging.current !== "hue") return;
          setHsv(localUnit(event).x * 360, hsv.s, hsv.v);
        }}
        onPointerUp={() => {
          dragging.current = null;
        }}
      >
        <div
          className="pointer-events-none absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-none border-2 border-white bg-white shadow"
          style={{ left: `${(hsv.h / 360) * 100}%` }}
        />
      </div>

      <div
        className="checker relative h-3 w-full overflow-hidden rounded-none"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          dragging.current = "alpha";
          onChange({ ...color, a: Math.round(localUnit(event).x * 255) });
        }}
        onPointerMove={(event) => {
          if (dragging.current !== "alpha") return;
          onChange({ ...color, a: Math.round(localUnit(event).x * 255) });
        }}
        onPointerUp={() => {
          dragging.current = null;
        }}
      >
        <div
          className="absolute inset-0 rounded-none"
          style={{
            background: `linear-gradient(to right, transparent, rgb(${color.r}, ${color.g}, ${color.b}))`,
          }}
        />
        <div
          className="pointer-events-none absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-none border-2 border-accent bg-white shadow"
          style={{ left: `${(color.a / 255) * 100}%` }}
        />
      </div>

      <div className="flex items-center gap-2">
        <div className="checker size-8 overflow-hidden rounded-none border border-zinc-500">
          <div className="h-full w-full" style={{ background: `rgba(${color.r},${color.g},${color.b},${color.a / 255})` }} />
        </div>
        <input
          className="panel-field no-drag h-8 flex-1 rounded-none px-2 font-mono text-xs uppercase tracking-wide outline-none"
          value={hexFromRgba(color)}
          onChange={(event) => {
            const next = rgbaFromHex(event.target.value, color.a);
            if (next) onChange(next);
          }}
        />
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {(["r", "g", "b", "a"] as const).map((channel) => (
          <label key={channel} className="space-y-1">
            <span className="chrome-label block">{channel}</span>
            <input
              type="number"
              min={0}
              max={255}
              value={color[channel]}
              className="panel-field no-drag h-8 w-full rounded-none px-1.5 font-mono text-xs outline-none"
              onChange={(event) =>
                onChange({ ...color, [channel]: clamp(Number(event.target.value)) })
              }
            />
          </label>
        ))}
      </div>
    </div>
  );
}
