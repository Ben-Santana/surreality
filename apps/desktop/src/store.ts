import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import {
  createCircle,
  createPolygon,
  createCustomMapping,
  createSurface,
  createText,
  duplicateMapping,
  duplicateSurface,
  resetCounters,
} from "./factory";
import {
  add,
  boundingQuad,
  insertVertexNear,
  isCircleGeometry,
  isPolygonGeometry,
  isValidWall,
  moveCircleVertex,
  sub,
  surfaceAnchor,
  translateVertices,
} from "./geometry";
import {
  anchorOf,
  screenToWall,
  screenToWallPoint,
  surfaceById,
  topSurfaceAt,
  wallMetric,
  wallSizeFromQuad,
  wallToScreenPoint,
} from "./wall";
import type {
  ContextMenuState,
  Mapping,
  PanelLayout,
  PanelSkew,
  Point,
  Rgba,
  GridSize,
  Space,
  Surface,
  Tool,
} from "./types";
import { IDENTITY_SKEW, PANEL_SIZE } from "./types";

import { packageIdForLegacyKind } from "./customMappings/registry";

type HistorySnapshot = {
  mappings: Mapping[];
  surfaces: Surface[];
  selectedId: string | null;
};

type RoomState = {
  mappings: Mapping[];
  surfaces: Surface[];
  selectedId: string | null;
  past: HistorySnapshot[];
  future: HistorySnapshot[];
  editMode: boolean;
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: GridSize;
  tool: Tool;
  contextMenu: ContextMenuState | null;
  projectorOpen: boolean;
  panelLayout: PanelLayout | null;
  setPanelLayout: (layout: PanelLayout) => void;
  setTool: (tool: Tool, customMappingPackageId?: string) => void;
  customMappingPackageId: string;
  setCustomMappingPackage: (packageId: string) => void;
  addCustomMapping: (packageId: string, position: Point) => void;
  setEditMode: (editMode: boolean) => void;
  toggleGrid: () => void;
  toggleSnapToGrid: () => void;
  setGridSize: (size: GridSize) => void;
  select: (id: string | null) => void;
  addPolygon: (position: Point) => void;
  addPolygonVertices: (vertices: Point[]) => void;
  addCircle: (position: Point) => void;
  addText: (position: Point) => void;
  addSurface: (position: Point) => void;
  addAt: (tool: Exclude<Tool, "select">, position: Point) => void;
  updateMapping: (id: string, patch: Partial<Mapping>) => void;
  updateSurface: (id: string, patch: Partial<Surface>) => void;
  setColor: (id: string, color: Rgba) => void;
  setVertices: (id: string, vertices: Point[]) => void;
  moveVertex: (id: string, index: number, position: Point) => void;
  moveAnchor: (id: string, position: Point) => void;
  moveSurfaceVertex: (id: string, index: number, position: Point) => void;
  moveSurfaceAnchor: (id: string, position: Point) => void;
  addVertexNear: (id: string, position: Point) => void;
  attachMapping: (mappingId: string, surfaceId: string) => void;
  detachMapping: (mappingId: string) => void;
  deleteSelected: () => void;
  deleteMapping: (id: string) => void;
  deleteSurface: (id: string) => void;
  duplicateSelected: () => void;
  bringForward: (id: string) => void;
  bringBack: (id: string) => void;
  sendToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  openMenu: (menu: Omit<ContextMenuState, "colorMode">) => void;
  closeMenu: () => void;
  setColorMode: (colorMode: boolean) => void;
  setProjectorOpen: (open: boolean) => void;
  spaces: Space[];
  activeSpaceId: string | null;
  spaceEntered: boolean;
  spaceNamePrompt: "save" | "save-as" | null;
  isSpaceDirty: () => boolean;
  createBlankSpace: () => void;
  requestSave: () => void;
  requestSaveAs: () => void;
  closeSpaceNamePrompt: () => void;
  confirmSpaceName: (name: string) => void;
  saveActiveSpace: (name?: string) => void;
  saveSpaceAs: (name: string) => void;
  loadSpace: (id: string) => void;
  renameSpace: (id: string, name: string) => void;
  deleteSpace: (id: string) => void;
  returnToSpacePicker: () => void;
  undo: () => void;
  redo: () => void;
  endHistoryGesture: () => void;
};

function debounceStorage(delay: number): StateStorage {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    getItem: (name) => localStorage.getItem(name),
    setItem: (name, value) => {
      clearTimeout(timer);
      timer = setTimeout(() => localStorage.setItem(name, value), delay);
    },
    removeItem: (name) => localStorage.removeItem(name),
  };
}

function rectCorners(position: Point, size: { width: number; height: number }, skew: PanelSkew = IDENTITY_SKEW): PanelSkew {
  const { x, y } = position;
  const { width, height } = size;
  return [
    add({ x, y }, skew[0] ?? { x: 0, y: 0 }),
    add({ x: x + width, y }, skew[1] ?? { x: 0, y: 0 }),
    add({ x: x + width, y: y + height }, skew[2] ?? { x: 0, y: 0 }),
    add({ x, y: y + height }, skew[3] ?? { x: 0, y: 0 }),
  ];
}

function axisAlignedCorners(corners: PanelSkew): PanelSkew {
  const xs = corners.map((corner) => corner.x);
  const ys = corners.map((corner) => corner.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const width = Math.max(32, Math.max(...xs) - x);
  const height = Math.max(32, Math.max(...ys) - y);
  return rectCorners({ x, y }, { width, height });
}

function normalizePanelLayout(layout: unknown): PanelLayout | null {
  if (!layout || typeof layout !== "object") return null;
  const value = layout as {
    corners?: PanelSkew;
    position?: Point;
    skew?: PanelSkew;
  };
  if (Array.isArray(value.corners) && value.corners.length === 4) {
    return { corners: axisAlignedCorners(value.corners) };
  }
  if (value.position) {
    return { corners: rectCorners(value.position, PANEL_SIZE) };
  }
  return null;
}

function replace(mappings: Mapping[], id: string, patch: Partial<Mapping>): Mapping[] {
  return mappings.map((mapping) => {
    if (mapping.id !== id) return mapping;
    return { ...mapping, ...patch } as Mapping;
  });
}

function replaceSurface(surfaces: Surface[], id: string, patch: Partial<Surface>): Surface[] {
  return surfaces.map((surface) => (surface.id === id ? { ...surface, ...patch } : surface));
}

function cloneMappings(mappings: Mapping[]): Mapping[] {
  return structuredClone(mappings);
}

function cloneSurfaces(surfaces: Surface[]): Surface[] {
  return structuredClone(surfaces);
}

/**
 * Surfaces saved before mappings moved to wall coordinates have no wall size:
 * their wall was the quad's bounding box and their mappings stored screen
 * geometry, so those children need converting once.
 */
function normalizeSurfaces(value: unknown): { surfaces: Surface[]; legacyIds: Set<string> } {
  const surfaces: Surface[] = [];
  const legacyIds = new Set<string>();
  if (!Array.isArray(value)) return { surfaces, legacyIds };
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Partial<Surface>;
    if (typeof candidate.id !== "string" || typeof candidate.name !== "string") continue;
    if (!Array.isArray(candidate.vertices) || candidate.vertices.length !== 4) continue;
    if (isValidWall(candidate.wall)) {
      surfaces.push({
        id: candidate.id,
        name: candidate.name,
        vertices: candidate.vertices,
        wall: candidate.wall as Surface["wall"],
      });
      continue;
    }
    const bounds = boundingQuad(candidate.vertices);
    surfaces.push({
      id: candidate.id,
      name: candidate.name,
      vertices: candidate.vertices,
      wall: {
        width: bounds[1].x - bounds[0].x,
        height: bounds[3].y - bounds[0].y,
      },
    });
    legacyIds.add(candidate.id);
  }
  return { surfaces, legacyIds };
}

function normalizeSpaces(value: unknown): Space[] {
  if (!Array.isArray(value)) return [];
  const spaces: Space[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Partial<Space>;
    if (typeof candidate.id !== "string" || typeof candidate.name !== "string") continue;
    if (!Array.isArray(candidate.mappings)) continue;
    const { surfaces, legacyIds } = normalizeSurfaces(candidate.surfaces);
    const mappings = candidate.mappings.map((rawMapping) => {
      const mapping = normalizeMapping(rawMapping);
      if (!mapping.surfaceId || !legacyIds.has(mapping.surfaceId)) return mapping;
      const surface = surfaceById(surfaces, mapping.surfaceId);
      if (!surface) return mapping;
      return { ...mapping, vertices: screenToWall(surface, mapping.vertices) } as Mapping;
    });
    spaces.push({
      id: candidate.id,
      name: candidate.name,
      mappings,
      surfaces,
      updatedAt: typeof candidate.updatedAt === "number" ? candidate.updatedAt : Date.now(),
    });
  }
  return spaces;
}

/** Convert the old in-app "special" shape without dropping user configuration. */
function normalizeMapping(value: Mapping | Record<string, unknown>): Mapping {
  const candidate = value as unknown as Record<string, unknown> & {
    type: string;
    kind?: string;
    version?: number;
  };
  if (candidate.type !== "special") return value as Mapping;
  const kind = typeof candidate.kind === "string" ? candidate.kind : "unknown";
  const { kind: _kind, version: _version, ...mapping } = candidate;
  return {
    ...mapping,
    type: "custom",
    packageId: packageIdForLegacyKind(kind),
    packageVersion: "1.0.0",
    configVersion: typeof candidate.version === "number" ? candidate.version : 1,
  } as unknown as Mapping;
}

export function isUntitledSpace(space: Space | null | undefined) {
  return !space?.name.trim();
}

export function spaceLabel(space: Space | null | undefined) {
  return space?.name.trim() || "Untitled";
}

export function nextSpaceName(spaces: Space[]) {
  const names = new Set(spaces.map((space) => space.name.toLowerCase()));
  let index = 1;
  while (names.has(`space ${index}`)) index += 1;
  return `Space ${index}`;
}

function flushUntitled(
  spaces: Space[],
  activeSpaceId: string | null,
  mappings: Mapping[],
  surfaces: Surface[],
) {
  const active = spaces.find((space) => space.id === activeSpaceId);
  if (!active || !isUntitledSpace(active)) return spaces;
  return spaces.map((space) =>
    space.id === active.id
      ? {
          ...space,
          mappings: cloneMappings(mappings),
          surfaces: cloneSurfaces(surfaces),
          updatedAt: Date.now(),
        }
      : space,
  );
}

function uniqueSpaceName(spaces: Space[], desired: string, ignoreId?: string) {
  const trimmed = desired.trim() || "Space";
  const names = new Set(
    spaces.filter((space) => space.id !== ignoreId).map((space) => space.name.toLowerCase()),
  );
  if (!names.has(trimmed.toLowerCase())) return trimmed;
  let index = 2;
  while (names.has(`${trimmed} ${index}`.toLowerCase())) index += 1;
  return `${trimmed} ${index}`;
}

function isGridSize(value: unknown): value is GridSize {
  return value === "small" || value === "medium" || value === "large";
}

function snapshotEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

const HISTORY_LIMIT = 100;
const COALESCE_MS = 500;

let coalesceKey: string | null = null;
let coalesceTimer: ReturnType<typeof setTimeout> | undefined;

function captureHistory(state: HistorySnapshot): HistorySnapshot {
  return {
    mappings: cloneMappings(state.mappings),
    surfaces: cloneSurfaces(state.surfaces),
    selectedId: state.selectedId,
  };
}

function clearCoalesce() {
  coalesceKey = null;
  clearTimeout(coalesceTimer);
}

function bumpCoalesce(key: string) {
  coalesceKey = key;
  clearTimeout(coalesceTimer);
  coalesceTimer = setTimeout(() => {
    coalesceKey = null;
  }, COALESCE_MS);
}

function emptyHistory(): Pick<RoomState, "past" | "future"> {
  clearCoalesce();
  return { past: [], future: [] };
}

function withHistory(
  set: (partial: Partial<RoomState>) => void,
  get: () => RoomState,
  patch: Partial<RoomState>,
  key?: string,
) {
  if (key && key === coalesceKey) {
    bumpCoalesce(key);
    set(patch);
    return;
  }
  if (key) bumpCoalesce(key);
  else clearCoalesce();
  const state = get();
  set({
    ...patch,
    past: [...state.past, captureHistory(state)].slice(-HISTORY_LIMIT),
    future: [],
  });
}

export const useRoomStore = create<RoomState>()(
  persist(
    (set, get) => ({
      mappings: [],
      surfaces: [],
      selectedId: null,
      past: [],
      future: [],
      editMode: true,
      showGrid: true,
      snapToGrid: false,
      gridSize: "medium",
      tool: "select",
      customMappingPackageId: "room.mapping.media",
      contextMenu: null,
      projectorOpen: false,
      panelLayout: null,
      spaces: [],
      activeSpaceId: null,
      spaceEntered: false,
      spaceNamePrompt: null,
      setTool: (tool, customMappingPackageId) =>
        set({
          tool,
          customMappingPackageId: customMappingPackageId ?? get().customMappingPackageId,
          editMode: true,
        }),
      setCustomMappingPackage: (packageId) =>
        set({ customMappingPackageId: packageId, tool: "custom", editMode: true }),
      setEditMode: (editMode) =>
        set({
          editMode,
          contextMenu: editMode ? get().contextMenu : null,
          tool: editMode ? get().tool : "select",
        }),
      toggleGrid: () => set({ showGrid: !get().showGrid }),
      toggleSnapToGrid: () => {
        if (!get().showGrid) return;
        set({ snapToGrid: !get().snapToGrid });
      },
      setGridSize: (gridSize) => set({ gridSize }),
      select: (id) => set({ selectedId: id, editMode: true }),
      addPolygon: (position) => {
        const mapping = createPolygon(position);
        withHistory(set, get, {
          mappings: [...get().mappings, mapping],
          selectedId: mapping.id,
          tool: "select",
          editMode: true,
        });
      },
      addPolygonVertices: (vertices) => {
        if (vertices.length < 3) return;
        const first = vertices[0];
        if (!first) return;
        const mapping = { ...createPolygon(first), vertices: vertices.map((vertex) => ({ ...vertex })) };
        withHistory(set, get, {
          mappings: [...get().mappings, mapping],
          selectedId: mapping.id,
          tool: "select",
          editMode: true,
        });
      },
      addCircle: (position) => {
        const mapping = createCircle(position);
        withHistory(set, get, {
          mappings: [...get().mappings, mapping],
          selectedId: mapping.id,
          tool: "select",
          editMode: true,
        });
      },
      addText: (position) => {
        const mapping = createText(position);
        withHistory(set, get, {
          mappings: [...get().mappings, mapping],
          selectedId: mapping.id,
          tool: "select",
          editMode: true,
        });
      },
      addCustomMapping: (packageId, position) => {
        const mapping = createCustomMapping(packageId, position);
        if (!mapping) return;
        withHistory(set, get, {
          mappings: [...get().mappings, mapping],
          selectedId: mapping.id,
          tool: "select",
          editMode: true,
        });
      },
      addSurface: (position) => {
        const surface = createSurface(position);
        withHistory(set, get, {
          surfaces: [...get().surfaces, surface],
          selectedId: surface.id,
          tool: "select",
          editMode: true,
        });
      },
      addAt: (tool, position) => {
        if (tool === "polygon") get().addPolygon(position);
        if (tool === "circle") get().addCircle(position);
        if (tool === "text") get().addText(position);
        if (tool === "custom") get().addCustomMapping(get().customMappingPackageId, position);
        if (tool === "surface") get().addSurface(position);
      },
      updateMapping: (id, patch) =>
        withHistory(
          set,
          get,
          { mappings: replace(get().mappings, id, patch) },
          `mapping:${id}:${Object.keys(patch).sort().join(",")}`,
        ),
      updateSurface: (id, patch) =>
        withHistory(
          set,
          get,
          { surfaces: replaceSurface(get().surfaces, id, patch) },
          `surface:${id}:${Object.keys(patch).sort().join(",")}`,
        ),
      setColor: (id, color) =>
        withHistory(set, get, { mappings: replace(get().mappings, id, { color }) }, `color:${id}`),
      setVertices: (id, vertices) =>
        withHistory(set, get, { mappings: replace(get().mappings, id, { vertices }) }, `vertices:${id}`),
      moveVertex: (id, index, position) => {
        const mapping = get().mappings.find((item) => item.id === id);
        if (!mapping) return;
        const surface = surfaceById(get().surfaces, mapping.surfaceId);
        const local = surface ? screenToWallPoint(surface, position) : position;
        const vertices = isCircleGeometry(mapping)
          ? moveCircleVertex(mapping.vertices, index, local)
          : mapping.vertices.map((vertex, vertexIndex) =>
              vertexIndex === index ? local : vertex,
            );
        withHistory(set, get, { mappings: replace(get().mappings, id, { vertices }) }, `vertex:${id}:${index}`);
      },
      moveAnchor: (id, position) => {
        const mapping = get().mappings.find((item) => item.id === id);
        if (!mapping) return;
        // The stored shape is unskewed in both screen and wall space, so moving
        // on or off a wall is only ever a translation of the same geometry.
        const target = topSurfaceAt(get().surfaces, position);
        const anchor = target ? screenToWallPoint(target, position) : position;
        withHistory(
          set,
          get,
          {
            mappings: replace(get().mappings, id, {
              surfaceId: target?.id ?? null,
              vertices: translateVertices(mapping.vertices, sub(anchor, anchorOf(mapping))),
            }),
          },
          `anchor:${id}`,
        );
      },
      addVertexNear: (id, position) => {
        const mapping = get().mappings.find((item) => item.id === id);
        if (!mapping || !isPolygonGeometry(mapping)) return;
        const surface = surfaceById(get().surfaces, mapping.surfaceId);
        const local = surface ? screenToWallPoint(surface, position) : position;
        withHistory(set, get, {
          mappings: replace(get().mappings, id, {
            vertices: insertVertexNear(mapping.vertices, local),
          }),
        });
      },
      moveSurfaceVertex: (id, index, position) => {
        const surface = get().surfaces.find((item) => item.id === id);
        if (!surface) return;
        const vertices = surface.vertices.map((vertex, vertexIndex) =>
          vertexIndex === index ? position : vertex,
        );
        withHistory(
          set,
          get,
          {
            surfaces: replaceSurface(get().surfaces, id, {
              vertices,
              wall: wallSizeFromQuad(vertices) ?? surface.wall,
            }),
          },
          `svertex:${id}:${index}`,
        );
      },
      moveSurfaceAnchor: (id, position) => {
        const surface = get().surfaces.find((item) => item.id === id);
        if (!surface) return;
        const delta = sub(position, surfaceAnchor(surface));
        withHistory(
          set,
          get,
          {
            surfaces: replaceSurface(get().surfaces, id, {
              vertices: translateVertices(surface.vertices, delta),
            }),
          },
          `sanchor:${id}`,
        );
      },
      attachMapping: (mappingId, surfaceId) => {
        const mapping = get().mappings.find((item) => item.id === mappingId);
        const surface = surfaceById(get().surfaces, surfaceId);
        if (!mapping || !surface || mapping.surfaceId === surfaceId) return;
        const from = surfaceById(get().surfaces, mapping.surfaceId);
        const screenAnchor = from
          ? wallToScreenPoint(from, anchorOf(mapping))
          : anchorOf(mapping);
        const onWall = topSurfaceAt([surface], screenAnchor);
        const metric = wallMetric(surface);
        const anchor = onWall
          ? screenToWallPoint(surface, screenAnchor)
          : { x: metric.width / 2, y: metric.height / 2 };
        withHistory(set, get, {
          mappings: replace(get().mappings, mappingId, {
            surfaceId,
            vertices: translateVertices(mapping.vertices, sub(anchor, anchorOf(mapping))),
          }),
          selectedId: mappingId,
        });
      },
      detachMapping: (mappingId) => {
        const mapping = get().mappings.find((item) => item.id === mappingId);
        if (!mapping?.surfaceId) return;
        const surface = surfaceById(get().surfaces, mapping.surfaceId);
        const anchor = surface
          ? wallToScreenPoint(surface, anchorOf(mapping))
          : anchorOf(mapping);
        withHistory(set, get, {
          mappings: replace(get().mappings, mappingId, {
            surfaceId: null,
            vertices: translateVertices(mapping.vertices, sub(anchor, anchorOf(mapping))),
          }),
        });
      },
      deleteSelected: () => {
        const { selectedId, mappings, surfaces } = get();
        if (!selectedId) return;
        if (mappings.some((mapping) => mapping.id === selectedId)) get().deleteMapping(selectedId);
        else if (surfaces.some((surface) => surface.id === selectedId)) get().deleteSurface(selectedId);
      },
      deleteMapping: (id) =>
        withHistory(set, get, {
          mappings: get().mappings.filter((mapping) => mapping.id !== id),
          selectedId: get().selectedId === id ? null : get().selectedId,
          contextMenu: null,
        }),
      deleteSurface: (id) => {
        const surface = surfaceById(get().surfaces, id);
        withHistory(set, get, {
          surfaces: get().surfaces.filter((item) => item.id !== id),
          mappings: get().mappings.map((mapping) => {
            if (mapping.surfaceId !== id) return mapping;
            const anchor = surface ? wallToScreenPoint(surface, anchorOf(mapping)) : anchorOf(mapping);
            return {
              ...mapping,
              surfaceId: null,
              vertices: translateVertices(mapping.vertices, sub(anchor, anchorOf(mapping))),
            } as Mapping;
          }),
          selectedId: get().selectedId === id ? null : get().selectedId,
          contextMenu: null,
        });
      },
      duplicateSelected: () => {
        const mapping = get().mappings.find((item) => item.id === get().selectedId);
        if (mapping) {
          const copy = duplicateMapping(mapping);
          withHistory(set, get, { mappings: [...get().mappings, copy], selectedId: copy.id });
          return;
        }
        const surface = get().surfaces.find((item) => item.id === get().selectedId);
        if (!surface) return;
        const copy = duplicateSurface(surface);
        withHistory(set, get, { surfaces: [...get().surfaces, copy], selectedId: copy.id });
      },
      bringForward: (id) => {
        const mappings = get().mappings.slice();
        const index = mappings.findIndex((mapping) => mapping.id === id);
        if (index === -1 || index >= mappings.length - 1) return;
        const current = mappings[index];
        const next = mappings[index + 1];
        if (!current || !next) return;
        mappings[index] = next;
        mappings[index + 1] = current;
        withHistory(set, get, { mappings });
      },
      bringBack: (id) => {
        const mappings = get().mappings.slice();
        const index = mappings.findIndex((mapping) => mapping.id === id);
        if (index <= 0) return;
        const current = mappings[index];
        const previous = mappings[index - 1];
        if (!current || !previous) return;
        mappings[index] = previous;
        mappings[index - 1] = current;
        withHistory(set, get, { mappings });
      },
      sendToFront: (id) => {
        const mappings = get().mappings.filter((mapping) => mapping.id !== id);
        const mapping = get().mappings.find((item) => item.id === id);
        if (!mapping) return;
        withHistory(set, get, { mappings: [...mappings, mapping] });
      },
      sendToBack: (id) => {
        const mappings = get().mappings.filter((mapping) => mapping.id !== id);
        const mapping = get().mappings.find((item) => item.id === id);
        if (!mapping) return;
        withHistory(set, get, { mappings: [mapping, ...mappings] });
      },
      openMenu: (menu) => set({ contextMenu: { ...menu, colorMode: false }, editMode: true }),
      closeMenu: () => set({ contextMenu: null }),
      setColorMode: (colorMode) => {
        const menu = get().contextMenu;
        if (menu) set({ contextMenu: { ...menu, colorMode } });
      },
      setProjectorOpen: (open) => set({ projectorOpen: open }),
      setPanelLayout: (layout) => set({ panelLayout: layout }),
      isSpaceDirty: () => {
        const { mappings, surfaces, spaces, activeSpaceId } = get();
        const space = spaces.find((item) => item.id === activeSpaceId);
        if (!space) return false;
        if (isUntitledSpace(space)) return true;
        return !snapshotEqual(
          { mappings, surfaces },
          { mappings: space.mappings, surfaces: space.surfaces ?? [] },
        );
      },
      createBlankSpace: () => {
        const { spaces, activeSpaceId, mappings, surfaces } = get();
        const flushed = flushUntitled(spaces, activeSpaceId, mappings, surfaces);
        const next: Space = {
          id: crypto.randomUUID(),
          name: "",
          mappings: [],
          surfaces: [],
          updatedAt: Date.now(),
        };
        resetCounters([]);
        set({
          spaces: [...flushed, next],
          activeSpaceId: next.id,
          mappings: [],
          surfaces: [],
          selectedId: null,
          contextMenu: null,
          tool: "select",
          spaceEntered: true,
          spaceNamePrompt: null,
          ...emptyHistory(),
        });
      },
      requestSave: () => {
        const space = get().spaces.find((item) => item.id === get().activeSpaceId);
        if (!space || isUntitledSpace(space)) {
          set({ spaceNamePrompt: "save" });
          return;
        }
        get().saveActiveSpace();
      },
      requestSaveAs: () => set({ spaceNamePrompt: "save-as" }),
      closeSpaceNamePrompt: () => set({ spaceNamePrompt: null }),
      confirmSpaceName: (name) => {
        const prompt = get().spaceNamePrompt;
        const trimmed = name.trim();
        if (!trimmed || !prompt) return;
        if (prompt === "save-as") get().saveSpaceAs(trimmed);
        else get().saveActiveSpace(trimmed);
        set({ spaceNamePrompt: null });
      },
      saveActiveSpace: (name) => {
        const { mappings, surfaces, spaces, activeSpaceId } = get();
        const current = spaces.find((space) => space.id === activeSpaceId);
        if (!current) return;
        if (isUntitledSpace(current) && !name?.trim()) return;
        const spaceName = uniqueSpaceName(
          spaces,
          name?.trim() || current.name,
          current.id,
        );
        if (!spaceName.trim()) return;
        const next: Space = {
          id: current.id,
          name: spaceName,
          mappings: cloneMappings(mappings),
          surfaces: cloneSurfaces(surfaces),
          updatedAt: Date.now(),
        };
        set({
          spaces: spaces.map((space) => (space.id === current.id ? next : space)),
          activeSpaceId: current.id,
          spaceEntered: true,
        });
      },
      saveSpaceAs: (name) => {
        const { mappings, surfaces, spaces, activeSpaceId } = get();
        const trimmed = name.trim();
        if (!trimmed) return;
        const flushed = flushUntitled(spaces, activeSpaceId, mappings, surfaces);
        const next: Space = {
          id: crypto.randomUUID(),
          name: uniqueSpaceName(flushed, trimmed),
          mappings: cloneMappings(mappings),
          surfaces: cloneSurfaces(surfaces),
          updatedAt: Date.now(),
        };
        set({ spaces: [...flushed, next], activeSpaceId: next.id, spaceEntered: true });
      },
      loadSpace: (id) => {
        const { spaces, activeSpaceId, mappings, surfaces } = get();
        const flushed = flushUntitled(spaces, activeSpaceId, mappings, surfaces);
        const space = flushed.find((item) => item.id === id);
        if (!space) return;
        const nextMappings = cloneMappings(space.mappings);
        const nextSurfaces = cloneSurfaces(space.surfaces ?? []);
        resetCounters(nextMappings, nextSurfaces);
        set({
          spaces: flushed,
          mappings: nextMappings,
          surfaces: nextSurfaces,
          activeSpaceId: space.id,
          selectedId: null,
          contextMenu: null,
          tool: "select",
          spaceEntered: true,
          spaceNamePrompt: null,
          ...emptyHistory(),
        });
      },
      renameSpace: (id, name) => {
        const { spaces } = get();
        const current = spaces.find((space) => space.id === id);
        const trimmed = name.trim();
        if (!current || !trimmed) return;
        const nextName = uniqueSpaceName(spaces, trimmed, id);
        set({
          spaces: spaces.map((space) =>
            space.id === id ? { ...space, name: nextName, updatedAt: Date.now() } : space,
          ),
        });
      },
      deleteSpace: (id) => {
        const { spaces, activeSpaceId, mappings, surfaces } = get();
        const flushed = flushUntitled(spaces, activeSpaceId, mappings, surfaces);
        const remaining = flushed.filter((space) => space.id !== id);
        if (activeSpaceId === id) {
          resetCounters([]);
          set({
            spaces: remaining,
            activeSpaceId: null,
            mappings: [],
            surfaces: [],
            selectedId: null,
            contextMenu: null,
            spaceEntered: false,
            spaceNamePrompt: null,
            ...emptyHistory(),
          });
          return;
        }
        set({ spaces: remaining });
      },
      returnToSpacePicker: () => {
        const { spaces, activeSpaceId, mappings, surfaces } = get();
        const active = spaces.find((space) => space.id === activeSpaceId);
        set({
          spaces: active
            ? spaces.map((space) =>
                space.id === active.id
                  ? {
                      ...space,
                      mappings: cloneMappings(mappings),
                      surfaces: cloneSurfaces(surfaces),
                      updatedAt: Date.now(),
                    }
                  : space,
              )
            : spaces,
          spaceEntered: false,
          selectedId: null,
          contextMenu: null,
          spaceNamePrompt: null,
        });
      },
      undo: () => {
        const state = get();
        const previous = state.past[state.past.length - 1];
        if (!previous) return;
        clearCoalesce();
        set({
          mappings: cloneMappings(previous.mappings),
          surfaces: cloneSurfaces(previous.surfaces),
          selectedId: previous.selectedId,
          past: state.past.slice(0, -1),
          future: [...state.future, captureHistory(state)],
          contextMenu: null,
        });
      },
      redo: () => {
        const state = get();
        const next = state.future[state.future.length - 1];
        if (!next) return;
        clearCoalesce();
        set({
          mappings: cloneMappings(next.mappings),
          surfaces: cloneSurfaces(next.surfaces),
          selectedId: next.selectedId,
          past: [...state.past, captureHistory(state)],
          future: state.future.slice(0, -1),
          contextMenu: null,
        });
      },
      endHistoryGesture: () => clearCoalesce(),
    }),
    {
      name: "surreality",
      version: 11,
      storage: createJSONStorage(() => debounceStorage(400)),
      partialize: (state) => {
        let spaces = state.spaces;
        const active = spaces.find((space) => space.id === state.activeSpaceId);
        if (active && isUntitledSpace(active)) {
          spaces = spaces.map((space) =>
            space.id === active.id
              ? {
                  ...space,
                  mappings: cloneMappings(state.mappings),
                  surfaces: cloneSurfaces(state.surfaces),
                  updatedAt: Date.now(),
                }
              : space,
          );
        }
        return {
          showGrid: state.showGrid,
          snapToGrid: state.snapToGrid,
          gridSize: state.gridSize,
          panelLayout: state.panelLayout,
          spaces,
        };
      },
      migrate: (persisted, version) => {
        const data = persisted as {
          mappings?: Mapping[];
          showGrid?: boolean;
          snapToGrid?: boolean;
          gridSize?: unknown;
          panelLayout?: unknown;
          panelLayouts?: Partial<Record<string, unknown>>;
          panelPositions?: Partial<Record<string, Point>>;
          spaces?: unknown;
          activeSpaceId?: unknown;
        };
        const layouts: Record<string, unknown> = { ...(data.panelLayouts ?? {}) };
        if (version < 2) {
          for (const [id, position] of Object.entries(data.panelPositions ?? {})) {
            if (!position || layouts[id]) continue;
            layouts[id] = { position, skew: IDENTITY_SKEW };
          }
        }
        const panelLayout = normalizePanelLayout(
          data.panelLayout ??
            layouts.controls ??
            layouts.tools ??
            layouts.inspector ??
            layouts.layers ??
            layouts.status ??
            null,
        );
        let spaces = normalizeSpaces(data.spaces);
        const liveMappings = Array.isArray(data.mappings)
          ? data.mappings.map((mapping) => normalizeMapping(mapping))
          : [];
        if (liveMappings.length > 0 && !spaces.some((space) => snapshotEqual(space.mappings, liveMappings))) {
          const activeId =
            typeof data.activeSpaceId === "string" && spaces.some((space) => space.id === data.activeSpaceId)
              ? data.activeSpaceId
              : null;
          const active = spaces.find((space) => space.id === activeId);
          if (active && isUntitledSpace(active)) {
            spaces = spaces.map((space) =>
              space.id === active.id ? { ...space, mappings: liveMappings, updatedAt: Date.now() } : space,
            );
          } else {
            spaces = [
              ...spaces,
              {
                id: crypto.randomUUID(),
                name: "",
                mappings: liveMappings,
                surfaces: [],
                updatedAt: Date.now(),
              },
            ];
          }
        }
        return {
          showGrid: data.showGrid ?? true,
          snapToGrid: data.snapToGrid ?? false,
          gridSize: isGridSize(data.gridSize) ? data.gridSize : "medium",
          panelLayout,
          spaces,
        };
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        resetCounters([]);
        state.spaceEntered = false;
        state.activeSpaceId = null;
        state.mappings = [];
        state.surfaces = [];
        state.selectedId = null;
        state.spaceNamePrompt = null;
        state.contextMenu = null;
      },
    },
  ),
);
