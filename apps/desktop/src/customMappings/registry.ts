import { useSyncExternalStore } from "react";
import { ditheredMediaSpecial } from "../specials/dithered-media/definition";
import { feynmanSpecial } from "../specials/feynman/definition";
import { mediaSpecial } from "../specials/media/definition";
import { shipSpecial } from "../specials/ship/definition";
import { soundSpecial } from "../specials/sound/definition";
import type { SpecialDefinition } from "../specials/types";
import type {
  CustomMappingPackageRecord,
} from "../types";

export const BUNDLED_PACKAGE_PREFIX = "room.mapping.";
export const CORE_MEDIA_PACKAGE_ID = "room.mapping.media";

export type CustomMappingPackage = CustomMappingPackageRecord & {
  definition?: SpecialDefinition<any>;
};

const bundledDefinitions = [
  mediaSpecial,
  ditheredMediaSpecial,
  feynmanSpecial,
  soundSpecial,
  shipSpecial,
];

const bundledDefinitionsById = new Map(
  bundledDefinitions.map((definition) => [`${BUNDLED_PACKAGE_PREFIX}${definition.kind}`, definition]),
);
const EMPTY_PACKAGES: CustomMappingPackage[] = [];

let installedPackages: CustomMappingPackageRecord[] = [];
let initialized = false;
let unsubscribeChanges: (() => void) | undefined;
let snapshot: CustomMappingPackage[] = EMPTY_PACKAGES;
const listeners = new Set<() => void>();

function rebuildSnapshot() {
  snapshot = installedPackages.map((item) => ({
    ...item,
    definition: bundledDefinitionsById.get(item.manifest.id),
  }));
  for (const listener of listeners) listener();
}

export async function initializeCustomMappings() {
  if (initialized) return;
  initialized = true;
  try {
    installedPackages = (await window.room?.listCustomMappings()) ?? [];
    rebuildSnapshot();
    unsubscribeChanges ??= window.room?.onCustomMappingsChanged(() => {
      void window.room?.listCustomMappings().then((packages) => {
        installedPackages = packages;
        rebuildSnapshot();
      });
    });
  } catch (error) {
    console.error("Could not list installed custom mappings", error);
  }
}

export async function importCustomMappingPackage() {
  if (!window.room?.importCustomMapping) {
    throw new Error("Custom mapping import is unavailable. Restart the desktop app to load the latest Electron integration.");
  }
  const result = await window.room.importCustomMapping();
  if (result.canceled) return result;
  installedPackages = [
    ...installedPackages.filter(
      ({ manifest }) =>
        manifest.id !== result.installed.manifest.id ||
        manifest.version !== result.installed.manifest.version,
    ),
    result.installed,
  ];
  rebuildSnapshot();
  return result;
}

export async function uninstallCustomMappingPackage(packageId: string, packageVersion: string) {
  if (!window.room?.uninstallCustomMapping) {
    throw new Error("Custom mapping uninstall is unavailable. Restart the desktop app to load the latest Electron integration.");
  }
  const result = await window.room.uninstallCustomMapping(packageId, packageVersion);
  if (result.removed) {
    installedPackages = installedPackages.filter(
      ({ manifest }) => manifest.id !== packageId || manifest.version !== packageVersion,
    );
    rebuildSnapshot();
  }
  return result;
}

export function listCustomMappings(): CustomMappingPackage[] {
  return snapshot.filter((item) => item.enabled);
}

export function listCustomMappingChoices(): CustomMappingPackage[] {
  return listCustomMappings();
}

export function getCustomMapping(
  packageId: string,
  packageVersion?: string,
): CustomMappingPackage | undefined {
  const candidates = listCustomMappings().filter(({ manifest }) => manifest.id === packageId);
  if (packageVersion) {
    return candidates.find(({ manifest }) => manifest.version === packageVersion);
  }
  return candidates.at(-1);
}

export function getBundledDefinition(packageId: string): SpecialDefinition<any> | undefined {
  return bundledDefinitionsById.get(packageId);
}

export function packageIdForLegacyKind(kind: string): string {
  return `${BUNDLED_PACKAGE_PREFIX}${kind}`;
}

export function legacyKindForPackage(packageId: string): string | null {
  return packageId.startsWith(BUNDLED_PACKAGE_PREFIX)
    ? packageId.slice(BUNDLED_PACKAGE_PREFIX.length)
    : null;
}

export function subscribeCustomMappings(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCustomMappings(): CustomMappingPackage[] {
  return useSyncExternalStore(subscribeCustomMappings, () => snapshot, () => EMPTY_PACKAGES);
}
