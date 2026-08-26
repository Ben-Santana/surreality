import type { ShipConfig } from "./config";
import type { SpecialInspectorProps } from "../types";

export function ShipInspector(_props: SpecialInspectorProps<ShipConfig>) {
  return (
    <p className="text-[12px] leading-relaxed text-white/40">
      In Present, left and right turn, up and down thrust, and space fires an
      instant laser. The beam stops on other mappings on the same surface. The
      ship coasts a little after you let go, and its last pose is kept when you
      leave Present.
    </p>
  );
}
