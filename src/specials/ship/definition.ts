import { ShipView } from "./ShipView";
import { ShipInspector } from "./Inspector";
import { defaultShipConfig, SHIP_CONTENT_SIZE, type ShipConfig } from "./config";
import type { SpecialDefinition } from "../types";

export const shipSpecial: SpecialDefinition<ShipConfig> = {
  kind: "ship",
  label: "Ship",
  description: "Fly with arrows, fire a laser with space. Stays on its surface.",
  contentSize: SHIP_CONTENT_SIZE,
  defaultColor: { r: 110, g: 210, b: 255, a: 255 },
  defaultConfig: defaultShipConfig,
  View: ShipView,
  Inspector: ShipInspector,
};
