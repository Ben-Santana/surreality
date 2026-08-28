import { Film } from "lucide-react";
import type { SpecialDefinition } from "../types";
import { defaultMediaConfig, parseMediaConfig, type MediaConfig } from "./config";
import { MediaInspector } from "./Inspector";
import { MediaView } from "./MediaView";

export const mediaSpecial: SpecialDefinition<MediaConfig> = {
  kind: "media",
  version: 1,
  label: "Media",
  description: "Warp an MP4, animated GIF, or still image onto a surface.",
  icon: Film,
  contentSize: { width: 480, height: 270 },
  defaultColor: { r: 255, g: 255, b: 255, a: 255 },
  defaultConfig: defaultMediaConfig,
  parseConfig: parseMediaConfig,
  geometry: "quad",
  solid: false,
  View: MediaView,
  Inspector: MediaInspector,
};
