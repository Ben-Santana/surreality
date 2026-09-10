import type { ShipConfig } from "./config";
import type { SpecialInspectorProps } from "../types";

import { defaultShipConfig } from "./config";
import { SOUND_PRESET_LABELS, SOUND_PRESETS, type SoundPresetId } from "../sound/config";
import InspectorSelect from "../../components/InspectorSelect";

export function ShipInspector({ config, onChange }: SpecialInspectorProps<ShipConfig>) {
  const current = { ...defaultShipConfig, ...config };
  return (
    <div className="space-y-4">
      <label className="flex items-center justify-between gap-3 text-[13px] text-white">
        <span>Start docked</span>
        <input
          type="checkbox"
          checked={current.startsDocked}
          onChange={(event) => onChange({ ...current, startsDocked: event.target.checked })}
          className="size-4 accent-accent"
        />
      </label>
      <label className="flex items-center justify-between gap-3 text-[13px] text-white">
        <span>Minigame</span>
        <input
          type="checkbox"
          checked={current.minigameEnabled}
          onChange={(event) => onChange({ ...current, minigameEnabled: event.target.checked })}
          className="size-4 accent-accent"
        />
      </label>
      {current.minigameEnabled ? (
        <div className="space-y-3">
          <label className="flex items-center justify-between gap-3 text-[13px] text-white">
            <span>Start key</span>
            <input
              value={current.minigameKey}
              maxLength={1}
              onChange={(event) => onChange({ ...current, minigameKey: event.target.value.toLowerCase() })}
              className="w-12 rounded border border-white/15 bg-black/25 px-2 py-1 text-center uppercase outline-none focus:border-accent"
            />
          </label>
          <div className="space-y-1.5 text-[13px] text-white">
            <span className="chrome-label">Enemy hit sound</span>
            <InspectorSelect
              ariaLabel="Enemy hit sound"
              value={current.minigameHitSound}
              onChange={(minigameHitSound) => onChange({ ...current, minigameHitSound: minigameHitSound as SoundPresetId })}
              options={SOUND_PRESETS.map((preset) => ({ id: preset, label: SOUND_PRESET_LABELS[preset] }))}
            />
          </div>
          <label className="block space-y-1.5">
            <span className="chrome-label">Hit volume</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={current.minigameHitVolume}
              onChange={(event) => onChange({ ...current, minigameHitVolume: Number(event.target.value) })}
              className="no-drag h-7 w-full accent-accent"
            />
          </label>
        </div>
      ) : null}
      <p className="text-[12px] leading-relaxed text-white/40">
        In Present, left and right turn, up and down thrust, space fires, and E
        releases a docked ship. Fly back over the circular dock to snap into it.
        A docked ship can still rotate and fire.
        {current.minigameEnabled ? ` Press ${current.minigameKey.toUpperCase() || "G"} to start the minigame.` : ""}
      </p>
    </div>
  );
}
