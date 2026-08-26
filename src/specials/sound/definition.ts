import { SoundView } from "./SoundView";
import { SoundInspector } from "./Inspector";
import { defaultSoundConfig, type SoundConfig } from "./config";
import { activateSound, applySoundSnapshot, onSoundPulse, soundSnapshot } from "./player";
import { Volume2 } from "lucide-react";
import type { SpecialDefinition } from "../types";

export const soundSpecial: SpecialDefinition<SoundConfig> = {
  kind: "sound",
  version: 1,
  label: "Sound",
  description: "Click a polygon or circle to play a preset or your own WAV.",
  contentSize: { width: 180, height: 150 },
  defaultColor: { r: 255, g: 140, b: 60, a: 210 },
  defaultConfig: defaultSoundConfig,
  geometry: "polygon",
  interactive: true,
  icon: Volume2,
  onEvent: ({ event, mapping, config }) => {
    if (event.type === "activate" || event.type === "hit") activateSound(mapping, config);
  },
  runtime: {
    subscribe: (listener) => onSoundPulse(() => listener()),
    getSnapshot: soundSnapshot,
    applySnapshot: applySoundSnapshot,
  },
  View: SoundView,
  Inspector: SoundInspector,
};
