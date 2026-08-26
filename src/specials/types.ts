import type { ComponentType } from "react";
import type { Point, Rgba, SpecialMapping } from "../types";

export type SpecialViewProps<C = Record<string, unknown>> = {
  mapping: SpecialMapping;
  config: C;
};

export type SpecialInspectorProps<C = Record<string, unknown>> = {
  mapping: SpecialMapping;
  config: C;
  onChange: (config: C, extra?: { vertices?: Point[] }) => void;
};

export type SpecialGeometry = "quad" | "polygon" | "circle";

export type SpecialDefinition<C = Record<string, unknown>> = {
  kind: string;
  label: string;
  description: string;
  contentSize: { width: number; height: number };
  defaultColor: Rgba;
  defaultConfig: C;
  /** How the mapping is laid out on the stage. Defaults to a warped quad. */
  geometry?: SpecialGeometry;
  /** Blocks ships and bullets on the same surface. Defaults to true. */
  solid?: boolean;
  /** Present-mode clicks call `onActivate` instead of leaving present. */
  interactive?: boolean;
  onActivate?: (mapping: SpecialMapping, config: C) => void;
  View: ComponentType<SpecialViewProps<C>>;
  Inspector?: ComponentType<SpecialInspectorProps<C>>;
};

export function asConfig<C>(mapping: SpecialMapping, fallback: C): C {
  return { ...fallback, ...mapping.config } as C;
}

export function specialGeometry(
  mapping: SpecialMapping,
  fallback: SpecialGeometry = "quad",
): SpecialGeometry {
  const value = mapping.config.geometry;
  if (value === "quad" || value === "polygon" || value === "circle") return value;
  return fallback;
}
