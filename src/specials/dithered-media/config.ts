export type DitherAlgorithm = "threshold" | "bayer" | "atkinson" | "floyd-steinberg";
export type DitherPalette = "mono" | "amber" | "cyan" | "magenta" | "rgb";
export type DitherFit = "cover" | "contain" | "fill";

export type DitheredMediaConfig = {
  source: string;
  fileName: string;
  mediaType: "video" | "gif" | "image";
  fit: DitherFit;
  loop: boolean;
  muted: boolean;
  autoplay: boolean;
  algorithm: DitherAlgorithm;
  palette: DitherPalette;
  pixelSize: number;
  threshold: number;
  contrast: number;
  invert: boolean;
};

export const defaultDitheredMediaConfig: DitheredMediaConfig = {
  source: "",
  fileName: "",
  mediaType: "video",
  fit: "cover",
  loop: true,
  muted: true,
  autoplay: true,
  algorithm: "atkinson",
  palette: "mono",
  pixelSize: 3,
  threshold: 128,
  contrast: 1.15,
  invert: false,
};

export function parseDitheredMediaConfig(value: unknown): DitheredMediaConfig {
  const candidate = value && typeof value === "object" ? value as Partial<DitheredMediaConfig> : {};
  const algorithms: DitherAlgorithm[] = ["threshold", "bayer", "atkinson", "floyd-steinberg"];
  const palettes: DitherPalette[] = ["mono", "amber", "cyan", "magenta", "rgb"];
  return {
    ...defaultDitheredMediaConfig,
    source: typeof candidate.source === "string" ? candidate.source : "",
    fileName: typeof candidate.fileName === "string" ? candidate.fileName : "",
    mediaType: inferMediaType(candidate),
    fit: candidate.fit === "contain" || candidate.fit === "fill" ? candidate.fit : "cover",
    loop: candidate.loop !== false,
    muted: candidate.muted !== false,
    autoplay: candidate.autoplay !== false,
    algorithm: algorithms.includes(candidate.algorithm as DitherAlgorithm) ? candidate.algorithm as DitherAlgorithm : "atkinson",
    palette: palettes.includes(candidate.palette as DitherPalette) ? candidate.palette as DitherPalette : "mono",
    pixelSize: clampNumber(candidate.pixelSize, 1, 12, 3),
    threshold: clampNumber(candidate.threshold, 0, 255, 128),
    contrast: clampNumber(candidate.contrast, 0.5, 2.5, 1.15),
    invert: candidate.invert === true,
  };
}

function inferMediaType(candidate: Partial<DitheredMediaConfig>): DitheredMediaConfig["mediaType"] {
  if (candidate.mediaType === "gif") return "gif";
  if (candidate.mediaType === "video") return "video";
  if (candidate.mediaType === "image") {
    const name = `${candidate.fileName ?? ""}|${candidate.source ?? ""}`.toLowerCase();
    return name.includes("image/gif") || /\.gif(?:[?#]|$)/.test(name) ? "gif" : "image";
  }
  return "video";
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}
