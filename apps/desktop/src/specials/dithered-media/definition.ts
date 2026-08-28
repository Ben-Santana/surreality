import { Grid2X2 } from "lucide-react";
import type { SpecialDefinition } from "../types";
import { defaultDitheredMediaConfig, parseDitheredMediaConfig, type DitheredMediaConfig } from "./config";
import { DitheredMediaView } from "./DitheredMediaView";
import { DitheredMediaInspector } from "./Inspector";

export const ditheredMediaSpecial: SpecialDefinition<DitheredMediaConfig> = {
  kind: "dithered-media", version: 1, label: "Dithered Media",
  description: "Warp an MP4, GIF, or still image with print-style dithering.", icon: Grid2X2,
  contentSize: { width: 480, height: 270 }, defaultColor: { r: 255, g: 255, b: 255, a: 255 },
  defaultConfig: defaultDitheredMediaConfig, parseConfig: parseDitheredMediaConfig,
  geometry: "quad", solid: false, View: DitheredMediaView, Inspector: DitheredMediaInspector,
};
