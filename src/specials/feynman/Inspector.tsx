import {
  Circle,
  Hexagon,
  Octagon,
  Pentagon,
  Square,
  Triangle,
} from "lucide-react";
import type { ComponentType } from "react";
import ColorPicker from "../../components/ColorPicker";
import {
  defaultFeynmanConfig,
  FEYNMAN_EMOTION_LABELS,
  FEYNMAN_EMOTIONS,
  FEYNMAN_SHAPE_LABELS,
  FEYNMAN_SHAPES,
} from "./config";
import type { FeynmanConfig, FeynmanShape } from "./config";
import type { SpecialInspectorProps } from "../types";

const SHAPE_ICONS: Record<FeynmanShape, ComponentType<{ className?: string }>> = {
  circle: Circle,
  triangle: Triangle,
  square: Square,
  pentagon: Pentagon,
  hexagon: Hexagon,
  octagon: Octagon,
};

export function FeynmanInspector({ config, onChange }: SpecialInspectorProps<FeynmanConfig>) {
  const current = { ...defaultFeynmanConfig, ...config, eyeColor: config.eyeColor ?? defaultFeynmanConfig.eyeColor };

  return (
    <div className="space-y-4">
      <div>
        <p className="chrome-label mb-2">Eyes</p>
        <div className="flex flex-wrap gap-1.5">
          {FEYNMAN_EMOTIONS.map((emotion) => (
            <button
              key={emotion}
              type="button"
              onClick={() => onChange({ ...current, emotion })}
              className={`rounded-none px-2.5 py-1 text-[12px] transition ${
                current.emotion === emotion
                  ? "bg-accent text-white"
                  : "border border-white/15 text-white/50 hover:bg-white/10 hover:text-white"
              }`}
            >
              {FEYNMAN_EMOTION_LABELS[emotion]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="chrome-label mb-2">Eye color</p>
        <ColorPicker
          compact
          color={current.eyeColor}
          onChange={(eyeColor) => onChange({ ...current, eyeColor })}
        />
      </div>

      <div>
        <p className="chrome-label mb-2">Body shape</p>
        <div className="grid grid-cols-6 gap-1">
          {FEYNMAN_SHAPES.map((shape) => {
            const Icon = SHAPE_ICONS[shape];
            const selected = current.shape === shape;
            return (
              <button
                key={shape}
                type="button"
                title={FEYNMAN_SHAPE_LABELS[shape]}
                aria-label={FEYNMAN_SHAPE_LABELS[shape]}
                aria-pressed={selected}
                onClick={() => onChange({ ...current, shape })}
                className={`flex h-9 items-center justify-center rounded-none transition ${
                  selected
                    ? "bg-accent text-white"
                    : "border border-white/15 text-white/50 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="size-4" />
              </button>
            );
          })}
        </div>
      </div>

      <label className="flex items-center justify-between gap-3 text-[13px] text-white">
        <span>Look at pointer</span>
        <input
          type="checkbox"
          checked={current.look}
          onChange={(event) => onChange({ ...current, look: event.target.checked })}
          className="size-4 accent-accent"
        />
      </label>

      <button
        type="button"
        className="flex h-9 w-full items-center justify-center rounded-none border border-white/15 text-[13px] text-white hover:bg-white/10"
        onClick={() => onChange({ ...current, burstKey: current.burstKey + 1 })}
      >
        Burst
      </button>
    </div>
  );
}
