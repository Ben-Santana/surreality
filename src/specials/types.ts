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

export type SpecialEvent = {
  type: "activate" | "hit" | "signal";
  sourceId?: string;
  targetId?: string;
  point?: Point;
  channel?: string;
  value?: unknown;
};

export type SpecialEventContext<C> = {
  mapping: SpecialMapping;
  config: C;
  event: SpecialEvent;
  emit: (event: SpecialEvent) => void;
};

export type SpecialRuntime = {
  Host?: ComponentType;
  Overlay?: ComponentType;
  subscribe?: (listener: () => void) => () => void;
  getSnapshot?: () => unknown;
  applySnapshot?: (snapshot: unknown) => void;
};

export type SpecialDefinition<C = Record<string, unknown>> = {
  kind: string;
  version?: number;
  label: string;
  description: string;
  icon?: ComponentType<{ className?: string }>;
  contentSize: { width: number; height: number };
  defaultColor: Rgba;
  defaultConfig: C;
  parseConfig?: (value: unknown) => C;
  migrateConfig?: (value: unknown, fromVersion: number) => C;
  /** How the mapping is laid out on the stage. Defaults to a warped quad. */
  geometry?: SpecialGeometry;
  /** Blocks ships and bullets on the same surface. Defaults to true. */
  solid?: boolean;
  /** Present-mode clicks call `onActivate` instead of leaving present. */
  interactive?: boolean;
  onActivate?: (mapping: SpecialMapping, config: C) => void;
  onEvent?: (context: SpecialEventContext<C>) => void;
  runtime?: SpecialRuntime;
  View: ComponentType<SpecialViewProps<C>>;
  Inspector?: ComponentType<SpecialInspectorProps<C>>;
};

export function asConfig<C>(mapping: SpecialMapping, fallback: C): C {
  return { ...fallback, ...mapping.config } as C;
}

export function definitionConfig<C>(definition: SpecialDefinition<C>, mapping: SpecialMapping): C {
  const version = mapping.configVersion ?? 0;
  const current = definition.version ?? 1;
  const value = version < current && definition.migrateConfig
    ? definition.migrateConfig(mapping.config, version)
    : mapping.config;
  return definition.parseConfig
    ? definition.parseConfig(value)
    : asConfig(mapping, definition.defaultConfig);
}

export function specialGeometry(
  mapping: SpecialMapping,
  fallback: SpecialGeometry = "quad",
): SpecialGeometry {
  const value = mapping.config.geometry;
  if (value === "quad" || value === "polygon" || value === "circle") return value;
  return fallback;
}
