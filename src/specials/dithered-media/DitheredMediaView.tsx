import { useEffect, useRef } from "react";
import type { SpecialViewProps } from "../types";
import type { DitheredMediaConfig } from "./config";

const WIDTH = 480;
const HEIGHT = 270;
const BAYER_4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const PALETTES = {
  mono: [[8, 8, 11], [245, 245, 238]],
  amber: [[17, 8, 2], [255, 178, 45]],
  cyan: [[1, 12, 17], [56, 239, 255]],
  magenta: [[16, 3, 18], [255, 76, 222]],
} as const;

export function DitheredMediaView({ config }: SpecialViewProps<DitheredMediaConfig>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRef = useRef<HTMLVideoElement | HTMLImageElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !config.source) return;

    if (config.mediaType === "gif") {
      let cancelled = false;
      let frame = 0;
      void preprocessGif(config.source, config).then((frames) => {
        if (cancelled || frames.length === 0) return;
        const output = canvas.getContext("2d");
        if (!output) return;
        const totalDuration = frames.reduce((sum, item) => sum + item.duration, 0);
        const started = performance.now();
        const play = (now: number) => {
          if (cancelled) return;
          const elapsed = (now - started) % totalDuration;
          let cursor = 0;
          let selected = frames[0]!;
          for (const item of frames) {
            cursor += item.duration;
            if (elapsed < cursor) { selected = item; break; }
          }
          output.imageSmoothingEnabled = false;
          output.clearRect(0, 0, WIDTH, HEIGHT);
          output.drawImage(selected.canvas, 0, 0);
          frame = requestAnimationFrame(play);
        };
        frame = requestAnimationFrame(play);
      }).catch(() => undefined);
      return () => { cancelled = true; cancelAnimationFrame(frame); };
    }

    if (config.mediaType === "image") {
      let cancelled = false;
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => {
        if (!cancelled) renderDitheredFrame(canvas, image, config);
      };
      image.src = config.source;
      return () => { cancelled = true; image.src = ""; };
    }

    const media = document.createElement("video");
    mediaRef.current = media;
    // Chromium may decode only the first frame of an animated image that never
    // enters the document. Keep the source attached but visually hidden so its
    // animation timeline advances while the canvas samples each current frame.
    media.style.position = "absolute";
    media.style.width = "1px";
    media.style.height = "1px";
    media.style.opacity = "0";
    media.style.pointerEvents = "none";
    media.style.overflow = "hidden";
    canvas.parentElement?.appendChild(media);
    media.crossOrigin = "anonymous";
    media.src = config.source;
    if (media instanceof HTMLVideoElement) {
      media.loop = config.loop;
      media.muted = config.muted;
      media.autoplay = config.autoplay;
      media.playsInline = true;
      if (config.autoplay) void media.play().catch(() => undefined);
    }

    let frame = 0;
    let last = 0;
    const render = (now: number) => {
      if (now - last > 42) {
        drawDithered(canvas, media, config);
        last = now;
      }
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame);
      if (media instanceof HTMLVideoElement) { media.pause(); media.removeAttribute("src"); media.load(); }
      media.remove();
      mediaRef.current = null;
    };
  }, [
    config.algorithm,
    config.autoplay,
    config.contrast,
    config.fit,
    config.invert,
    config.loop,
    config.mediaType,
    config.muted,
    config.palette,
    config.pixelSize,
    config.source,
    config.threshold,
  ]);

  if (!config.source) {
    return <div className="flex h-full w-full items-center justify-center border border-dashed border-white/25 bg-black/90 font-mono text-[15px] uppercase tracking-[0.16em] text-white/35">Choose media</div>;
  }
  return <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="block h-full w-full" style={{ imageRendering: "pixelated" }} />;
}

type PreparedFrame = { canvas: HTMLCanvasElement; duration: number };

type GifDecoder = {
  tracks: { ready: Promise<void>; selectedTrack?: { frameCount?: number } };
  decode: (options: { frameIndex: number; completeFramesOnly: boolean }) => Promise<{
    image: CanvasImageSource & { duration?: number; close?: () => void };
  }>;
  close: () => void;
};

type GifDecoderConstructor = new (options: {
  data: ArrayBuffer;
  type: string;
  preferAnimation: boolean;
}) => GifDecoder;

async function preprocessGif(source: string, config: DitheredMediaConfig): Promise<PreparedFrame[]> {
  const Decoder = (globalThis as typeof globalThis & { ImageDecoder?: GifDecoderConstructor }).ImageDecoder;
  if (!Decoder) throw new Error("Animated GIF decoding is not supported by this runtime.");
  const response = await fetch(source);
  if (!response.ok) throw new Error("Could not load GIF.");
  const decoder = new Decoder({ data: await response.arrayBuffer(), type: "image/gif", preferAnimation: true });
  try {
    await decoder.tracks.ready;
    const frameCount = decoder.tracks.selectedTrack?.frameCount ?? 0;
    const frames: PreparedFrame[] = [];
    for (let index = 0; index < frameCount; index += 1) {
      const result = await decoder.decode({ frameIndex: index, completeFramesOnly: true });
      const canvas = document.createElement("canvas");
      canvas.width = WIDTH; canvas.height = HEIGHT;
      renderDitheredFrame(canvas, result.image, config);
      // WebCodecs reports microseconds; guard against zero-delay GIF frames.
      frames.push({ canvas, duration: Math.max(20, (result.image.duration ?? 100_000) / 1_000) });
      result.image.close?.();
    }
    return frames;
  } finally {
    decoder.close();
  }
}

function renderDitheredFrame(canvas: HTMLCanvasElement, source: CanvasImageSource, config: DitheredMediaConfig) {
  const scale = Math.max(1, Math.round(config.pixelSize));
  const width = Math.max(1, Math.floor(WIDTH / scale));
  const height = Math.max(1, Math.floor(HEIGHT / scale));
  const scratch = document.createElement("canvas");
  scratch.width = width; scratch.height = height;
  const ctx = scratch.getContext("2d", { willReadFrequently: true });
  const output = canvas.getContext("2d");
  if (!ctx || !output) return;
  const dimensions = source as CanvasImageSource & { displayWidth?: number; displayHeight?: number; codedWidth?: number; codedHeight?: number; naturalWidth?: number; naturalHeight?: number };
  const sourceWidth = dimensions.displayWidth ?? dimensions.codedWidth ?? dimensions.naturalWidth ?? WIDTH;
  const sourceHeight = dimensions.displayHeight ?? dimensions.codedHeight ?? dimensions.naturalHeight ?? HEIGHT;
  drawFitted(ctx, source, sourceWidth, sourceHeight, width, height, config.fit);
  const image = ctx.getImageData(0, 0, width, height);
  dither(image.data, width, height, config);
  ctx.putImageData(image, 0, 0);
  output.imageSmoothingEnabled = false;
  output.drawImage(scratch, 0, 0, WIDTH, HEIGHT);
}

function drawDithered(canvas: HTMLCanvasElement, media: HTMLVideoElement | HTMLImageElement, config: DitheredMediaConfig) {
  const ready = media instanceof HTMLVideoElement ? media.readyState >= 2 : media.complete && media.naturalWidth > 0;
  if (!ready) return;
  const scale = Math.max(1, Math.round(config.pixelSize));
  const width = Math.max(1, Math.floor(WIDTH / scale));
  const height = Math.max(1, Math.floor(HEIGHT / scale));
  const scratch = document.createElement("canvas");
  scratch.width = width; scratch.height = height;
  const ctx = scratch.getContext("2d", { willReadFrequently: true });
  const output = canvas.getContext("2d");
  if (!ctx || !output) return;
  const sw = media instanceof HTMLVideoElement ? media.videoWidth : media.naturalWidth;
  const sh = media instanceof HTMLVideoElement ? media.videoHeight : media.naturalHeight;
  drawFitted(ctx, media, sw, sh, width, height, config.fit);
  try {
    const image = ctx.getImageData(0, 0, width, height);
    dither(image.data, width, height, config);
    ctx.putImageData(image, 0, 0);
  } catch {
    // Cross-origin URLs without CORS still display, just without pixel processing.
  }
  output.imageSmoothingEnabled = false;
  output.clearRect(0, 0, WIDTH, HEIGHT);
  output.drawImage(scratch, 0, 0, WIDTH, HEIGHT);
}

function drawFitted(ctx: CanvasRenderingContext2D, source: CanvasImageSource, sw: number, sh: number, dw: number, dh: number, fit: DitheredMediaConfig["fit"]) {
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, dw, dh);
  if (fit === "fill" || !sw || !sh) { ctx.drawImage(source, 0, 0, dw, dh); return; }
  const ratio = fit === "cover" ? Math.max(dw / sw, dh / sh) : Math.min(dw / sw, dh / sh);
  const width = sw * ratio; const height = sh * ratio;
  ctx.drawImage(source, (dw - width) / 2, (dh - height) / 2, width, height);
}

function dither(data: Uint8ClampedArray, width: number, height: number, config: DitheredMediaConfig) {
  const values = new Float32Array(width * height);
  for (let i = 0; i < values.length; i += 1) {
    const p = i * 4;
    const luminance = (data[p]! * 0.2126 + data[p + 1]! * 0.7152 + data[p + 2]! * 0.0722 - 128) * config.contrast + 128;
    values[i] = config.invert ? 255 - luminance : luminance;
  }
  const add = (x: number, y: number, error: number, amount: number) => {
    if (x >= 0 && x < width && y >= 0 && y < height) {
      const index = y * width + x;
      values[index] = (values[index] ?? 0) + error * amount;
    }
  };
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const i = y * width + x; const p = i * 4;
    const bias = config.algorithm === "bayer" ? (BAYER_4[(y % 4) * 4 + (x % 4)]! - 7.5) * 10 : 0;
    const old = values[i]!; const high = old + bias >= config.threshold; const next = high ? 255 : 0;
    if (config.palette === "rgb") {
      const levels = config.invert ? 255 - next : next;
      data[p] = data[p]! >= config.threshold ? levels : 0;
      data[p + 1] = data[p + 1]! >= config.threshold ? levels : 0;
      data[p + 2] = data[p + 2]! >= config.threshold ? levels : 0;
    } else {
      const palette = PALETTES[config.palette]; const color = high ? palette[1] : palette[0];
      data[p] = color[0]; data[p + 1] = color[1]; data[p + 2] = color[2];
    }
    data[p + 3] = 255;
    if (config.algorithm === "threshold" || config.algorithm === "bayer") continue;
    const error = old - next;
    if (config.algorithm === "floyd-steinberg") {
      add(x + 1, y, error, 7 / 16); add(x - 1, y + 1, error, 3 / 16); add(x, y + 1, error, 5 / 16); add(x + 1, y + 1, error, 1 / 16);
    } else {
      add(x + 1, y, error, 1 / 8); add(x + 2, y, error, 1 / 8); add(x - 1, y + 1, error, 1 / 8); add(x, y + 1, error, 1 / 8); add(x + 1, y + 1, error, 1 / 8); add(x, y + 2, error, 1 / 8);
    }
  }
}
