import { FeynmanView } from "./FeynmanView";
import { FeynmanInspector } from "./Inspector";
import { defaultFeynmanConfig } from "./config";
import type { SpecialDefinition } from "../types";
import type { FeynmanConfig } from "./config";
import { Bot } from "lucide-react";

export const feynmanSpecial: SpecialDefinition<FeynmanConfig> = {
  kind: "feynman",
  version: 1,
  label: "Feynman",
  description: "Bloub, the Feynman character. Warp the quad onto a wall or object.",
  contentSize: { width: 250, height: 250 },
  defaultColor: { r: 232, g: 72, b: 63, a: 255 },
  defaultConfig: defaultFeynmanConfig,
  icon: Bot,
  View: FeynmanView,
  Inspector: FeynmanInspector,
};
