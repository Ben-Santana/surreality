import { feynmanSpecial } from "./feynman/definition";
import { shipSpecial } from "./ship/definition";
import { soundSpecial } from "./sound/definition";
import { mediaSpecial } from "./media/definition";
import { ditheredMediaSpecial } from "./dithered-media/definition";
import { definitionConfig } from "./types";
import type { SpecialDefinition } from "./types";
import type { SpecialMapping } from "../types";

export function registerSpecial<C>(definition: SpecialDefinition<C>): SpecialDefinition {
  if (!definition.kind.trim()) throw new Error("A mapping definition needs a kind");
  if (!Number.isFinite(definition.contentSize.width) || !Number.isFinite(definition.contentSize.height)) {
    throw new Error(`Mapping definition ${definition.kind} has an invalid content size`);
  }
  return definition as SpecialDefinition;
}

/**
 * Register special mappings here. Each kind is self-contained:
 * view, inspector, defaults, and size. To add another mapping, create a
 * folder next to `feynman/` and pass it through `registerSpecial`.
 */
export const specials: SpecialDefinition[] = [
  registerSpecial(mediaSpecial),
  registerSpecial(ditheredMediaSpecial),
  registerSpecial(feynmanSpecial),
  registerSpecial(soundSpecial),
  registerSpecial(shipSpecial),
];

export function getSpecial(kind: string): SpecialDefinition | undefined {
  return specials.find((item) => item.kind === kind);
}

export function listSpecials(): SpecialDefinition[] {
  return specials;
}

/** Definitions presented in the UI as special-purpose mappings. */
export function listSpecialMappingChoices(): SpecialDefinition[] {
  return specials.filter((item) => item.kind !== "media");
}

export function activateSpecial(mapping: SpecialMapping): boolean {
  const definition = getSpecial(mapping.packageId.startsWith("room.mapping.") ? mapping.packageId.slice("room.mapping.".length) : "");
  if (!definition?.interactive || !definition.onActivate) return false;
  definition.onActivate(mapping, definitionConfig(definition, mapping));
  return true;
}
