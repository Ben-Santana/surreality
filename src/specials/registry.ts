import { feynmanSpecial } from "./feynman/definition";
import { shipSpecial } from "./ship/definition";
import { soundSpecial } from "./sound/definition";
import { asConfig } from "./types";
import type { SpecialDefinition } from "./types";
import type { SpecialMapping } from "../types";

export function registerSpecial<C>(definition: SpecialDefinition<C>): SpecialDefinition {
  return definition as SpecialDefinition;
}

/**
 * Register special mappings here. Each kind is self-contained:
 * view, inspector, defaults, and size. To add another mapping, create a
 * folder next to `feynman/` and pass it through `registerSpecial`.
 */
export const specials: SpecialDefinition[] = [
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

export function activateSpecial(mapping: SpecialMapping): boolean {
  const definition = getSpecial(mapping.kind);
  if (!definition?.interactive || !definition.onActivate) return false;
  definition.onActivate(mapping, asConfig(mapping, definition.defaultConfig));
  return true;
}
