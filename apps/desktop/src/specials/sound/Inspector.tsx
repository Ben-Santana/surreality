import { Circle, Pentagon, Play, Upload, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { SpecialInspectorProps } from "../types";
import {
  SOUND_PRESET_LABELS,
  SOUND_PRESETS,
  circleToPolygonVertices,
  defaultSoundConfig,
  polygonToCircleVertices,
  type SoundConfig,
  type SoundGeometry,
} from "./config";
import { activateSound } from "./player";

export function SoundInspector({ mapping, config, onChange }: SpecialInspectorProps<SoundConfig>) {
  const current = { ...defaultSoundConfig, ...config };
  const [error, setError] = useState<string | null>(null);

  const setGeometry = (geometry: SoundGeometry) => {
    if (current.geometry === geometry) return;
    const vertices =
      geometry === "circle"
        ? polygonToCircleVertices(mapping.vertices)
        : circleToPolygonVertices(mapping.vertices);
    onChange({ ...current, geometry }, { vertices });
  };

  const onPickFile = async () => {
    setError(null);
    try {
      const result = await window.room?.importAsset("audio");
      if (!result || result.canceled) return;
      onChange({
        ...current,
        source: "custom",
        customAudio: result.asset.source,
        customName: result.asset.fileName,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not import that file.");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="chrome-label mb-2">Shape</p>
        <div className="grid grid-cols-2 gap-1.5">
          <ShapeButton
            selected={current.geometry === "polygon"}
            icon={<Pentagon className="size-4" />}
            onClick={() => setGeometry("polygon")}
          >
            Polygon
          </ShapeButton>
          <ShapeButton
            selected={current.geometry === "circle"}
            icon={<Circle className="size-4" />}
            onClick={() => setGeometry("circle")}
          >
            Circle
          </ShapeButton>
        </div>
      </div>

      <div>
        <p className="chrome-label mb-2">Presets</p>
        <div className="flex flex-wrap gap-1.5">
          {SOUND_PRESETS.map((preset) => {
            const selected = current.source === "preset" && current.preset === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => onChange({ ...current, source: "preset", preset })}
                className={`rounded-none px-2.5 py-1 text-[12px] transition ${
                  selected
                    ? "bg-accent text-white"
                    : "border border-white/15 text-white/50 hover:bg-white/10 hover:text-white"
                }`}
              >
                {SOUND_PRESET_LABELS[preset]}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="chrome-label mb-2">Your sound</p>
        <div className="flex gap-1.5">
          <button
            type="button"
            className={`flex h-9 min-w-0 flex-1 items-center justify-center gap-2 rounded-none border px-2 text-[13px] ${
              current.source === "custom" && current.customAudio
                ? "border-accent/50 bg-accent/15 text-white"
                : "border-white/15 text-white hover:bg-white/10"
            }`}
            onClick={() => {
              if (current.customAudio && current.source !== "custom") {
                onChange({ ...current, source: "custom" });
                return;
              }
              void onPickFile();
            }}
          >
            <Upload className="size-3.5 shrink-0" />
            <span className="truncate">{current.customName ?? "Upload WAV"}</span>
          </button>
          {current.customAudio ? (
            <button
              type="button"
              title="Remove uploaded sound"
              className="flex size-9 items-center justify-center rounded-none border border-white/15 text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() =>
                onChange({
                  ...current,
                  source: "preset",
                  customAudio: null,
                  customName: null,
                })
              }
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
        {error ? <p className="mt-1.5 text-[12px] text-danger">{error}</p> : null}
      </div>

      <label className="block space-y-1.5">
        <span className="chrome-label">Volume</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={current.volume}
          onChange={(event) => onChange({ ...current, volume: Number(event.target.value) })}
          className="no-drag h-7 w-full accent-accent"
        />
      </label>

      <button
        type="button"
        className="flex h-9 w-full items-center justify-center gap-2 rounded-none border border-white/15 text-[13px] text-white hover:bg-white/10"
        onClick={() => activateSound(mapping, current)}
      >
        <Play className="size-3.5" />
        Play
      </button>

      <p className="text-[12px] leading-relaxed text-white/40">
        In Present, click the mapping to play. Polygon pads can get extra vertices like a regular
        polygon.
      </p>
    </div>
  );
}

function ShapeButton({
  selected,
  icon,
  onClick,
  children,
}: {
  selected: boolean;
  icon: ReactNode;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-9 items-center justify-center gap-2 rounded-none text-[13px] transition ${
        selected
          ? "bg-accent text-white"
          : "border border-white/15 text-white/70 hover:bg-white/10 hover:text-white"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
