import type { ShipConfig } from "./config";
import type { SpecialInspectorProps } from "../types";

import { defaultShipConfig } from "./config";

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
      <p className="text-[12px] leading-relaxed text-white/40">
        In Present, left and right turn, up and down thrust, space fires, and E
        releases a docked ship. Fly back over the circular dock to snap into it.
        A docked ship can still rotate and fire.
      </p>
    </div>
  );
}
