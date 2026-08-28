import type { CustomMapping, CustomMappingGeometry } from "../types";
import { getCustomMapping } from "./registry";
import { definitionConfig } from "../specials/types";

export function customMappingConfig(mapping: CustomMapping): Record<string, unknown> {
  const entry = getCustomMapping(mapping.packageId, mapping.packageVersion);
  if (!entry) return mapping.config;
  if (entry.definition) return definitionConfig(entry.definition, mapping);
  return { ...entry.manifest.defaultConfig, ...mapping.config };
}

export function customMappingGeometry(
  mapping: CustomMapping,
  fallback: CustomMappingGeometry = "quad",
): CustomMappingGeometry {
  const value = mapping.config.geometry;
  if (value === "quad" || value === "polygon" || value === "circle") return value;
  return getCustomMapping(mapping.packageId, mapping.packageVersion)?.manifest.geometry ?? fallback;
}
