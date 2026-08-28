export type MediaFit = "cover" | "contain" | "fill";

export type MediaConfig = {
  source: string;
  fileName: string;
  mediaType: "video" | "image";
  fit: MediaFit;
  loop: boolean;
  muted: boolean;
  autoplay: boolean;
};

export const defaultMediaConfig: MediaConfig = {
  source: "",
  fileName: "",
  mediaType: "video",
  fit: "cover",
  loop: true,
  muted: true,
  autoplay: true,
};

export function parseMediaConfig(value: unknown): MediaConfig {
  const candidate = value && typeof value === "object" ? value as Partial<MediaConfig> : {};
  return {
    source: typeof candidate.source === "string" ? candidate.source : "",
    fileName: typeof candidate.fileName === "string" ? candidate.fileName : "",
    mediaType: candidate.mediaType === "image" ? "image" : "video",
    fit: candidate.fit === "contain" || candidate.fit === "fill" ? candidate.fit : "cover",
    loop: candidate.loop !== false,
    muted: candidate.muted !== false,
    autoplay: candidate.autoplay !== false,
  };
}
