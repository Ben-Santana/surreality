import { SoundView } from "./SoundView";
import { SoundInspector } from "./Inspector";
import { defaultSoundConfig, type SoundConfig } from "./config";
import { activateSound } from "./player";
import type { SpecialDefinition } from "../types";

export const soundSpecial: SpecialDefinition<SoundConfig> = {
  kind: "sound",
  label: "Sound",
  description: "Click a polygon or circle to play a preset or your own WAV.",
  contentSize: { width: 180, height: 150 },
  defaultColor: { r: 255, g: 140, b: 60, a: 210 },
  defaultConfig: defaultSoundConfig,
  geometry: "polygon",
  interactive: true,
  onActivate: activateSound,
  View: SoundView,
  Inspector: SoundInspector,
};
