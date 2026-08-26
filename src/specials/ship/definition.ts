import { ShipView } from "./ShipView";
import { ShipInspector } from "./Inspector";
import { defaultShipConfig, SHIP_CONTENT_SIZE, type ShipConfig } from "./config";
import type { SpecialDefinition } from "../types";
import { Rocket } from "lucide-react";
import { useShipRuntime } from "./runtime";
import { LiveShipBullets, LiveShipDocks, LiveShipExhaust } from "./ShipBullets";
import { useShipPlayStore } from "./playStore";
import { createElement, Fragment } from "react";

function ShipRuntimeHost() { useShipRuntime(); return null; }
function ShipOverlay() { return createElement(Fragment, null, createElement(LiveShipDocks), createElement(LiveShipExhaust), createElement(LiveShipBullets)); }

export const shipSpecial: SpecialDefinition<ShipConfig> = {
  kind: "ship",
  version: 1,
  label: "Ship",
  description: "Fly with arrows, fire with space, and optionally launch from a dock.",
  contentSize: SHIP_CONTENT_SIZE,
  defaultColor: { r: 110, g: 210, b: 255, a: 255 },
  defaultConfig: defaultShipConfig,
  icon: Rocket,
  runtime: {
    Host: ShipRuntimeHost,
    Overlay: ShipOverlay,
    subscribe: useShipPlayStore.subscribe,
    getSnapshot: () => {
      const { bullets, charges, exhaust, docks } = useShipPlayStore.getState();
      return { bullets, charges, exhaust, docks };
    },
    applySnapshot: (value) => {
      if (!value || typeof value !== "object") return;
      const play = value as ReturnType<typeof useShipPlayStore.getState>;
      useShipPlayStore.getState().setPlay({ bullets: play.bullets ?? [], charges: play.charges ?? {}, exhaust: play.exhaust ?? [], docks: play.docks ?? {} });
    },
  },
  View: ShipView,
  Inspector: ShipInspector,
};
