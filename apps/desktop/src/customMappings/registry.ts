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
const coreMediaPackage: CustomMappingPackage = {
  source: "bundled",
  enabled: true,
  definition: mediaSpecial,
  manifest: {
    manifestVersion: 2,
    id: CORE_MEDIA_PACKAGE_ID,
    name: mediaSpecial.label,
    version: "1.0.0",
    configVersion: mediaSpecial.version ?? 1,
    description: mediaSpecial.description,
    author: { name: "Surreality" },
    geometry: mediaSpecial.geometry ?? "quad",
    contentSize: mediaSpecial.contentSize,
    defaultColor: mediaSpecial.defaultColor,
    defaultConfig: { ...mediaSpecial.defaultConfig },
    entrypoints: { mapping: "__builtin__" },
    permissions: [],
    bundled: true,
  },
};

let installedPackages: CustomMappingPackageRecord[] = [];
let initialization: Promise<void> | undefined;
let unsubscribeChanges: (() => void) | undefined;
let snapshot: CustomMappingPackage[] = [coreMediaPackage];
const listeners = new Set<() => void>();

function rebuildSnapshot() {
  snapshot = [
    coreMediaPackage,
    ...installedPackages
      .filter((item) => item.manifest.id !== CORE_MEDIA_PACKAGE_ID)
      .map((item) => ({
        ...item,
        definition: bundledDefinitionsById.get(item.manifest.id),
      })),
  ];
  for (const listener of listeners) listener();
}

export async function initializeCustomMappings() {
  if (!window.room) return;
  if (!initialization) {
    initialization = (async () => {
      installedPackages = await window.room!.listCustomMappings();
      rebuildSnapshot();
      unsubscribeChanges ??= window.room!.onCustomMappingsChanged(() => {
        void window.room?.listCustomMappings().then((packages) => {
          installedPackages = packages;
          rebuildSnapshot();
        });
      });
    })().catch((error) => {
      initialization = undefined;
      console.error("Could not list installed custom mappings", error);
    });
  }
  await initialization;
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
  void initializeCustomMappings();
  return () => listeners.delete(listener);
}

export function useCustomMappings(): CustomMappingPackage[] {
  return useSyncExternalStore(subscribeCustomMappings, () => snapshot, () => EMPTY_PACKAGES);
}

// Vite can replace this module without remounting App during development.
// Rehydrate package state whenever the registry module itself is evaluated.
if (typeof window !== "undefined") void initializeCustomMappings();
