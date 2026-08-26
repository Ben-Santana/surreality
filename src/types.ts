export type Point = { x: number; y: number };

export type Rgba = { r: number; g: number; b: number; a: number };

export type Tool = "select" | "surface" | "polygon" | "circle" | "text" | "special";

export type GridSize = "small" | "medium" | "large";

export const GRID_STEPS: Record<GridSize, number> = {
  small: 24,
  medium: 48,
  large: 96,
};

export type Quad = [Point, Point, Point, Point];

export type PanelSkew = [Point, Point, Point, Point];

export type PanelLayout = {
  corners: PanelSkew;
};

export const IDENTITY_SKEW: PanelSkew = [
  { x: 0, y: 0 },
  { x: 0, y: 0 },
  { x: 0, y: 0 },
  { x: 0, y: 0 },
];

export const PANEL_SIZE = { width: 560, height: 516 };

export type MappingType = "polygon" | "circle" | "text" | "special";

type MappingBase = {
  id: string;
  name: string;
  color: Rgba;
  /**
   * Unskewed geometry. In screen coordinates when loose, in wall coordinates
   * when the mapping sits on a surface; the skew is derived, never stored.
   */
  vertices: Point[];
  surfaceId?: string | null;
};

export type WallSize = { width: number; height: number };

export type Surface = {
  id: string;
  name: string;
  /** How the wall rectangle appears on screen, as a quad. */
  vertices: Point[];
  /** The real, unskewed size of the wall. */
  wall: WallSize;
};

export type PolygonMapping = MappingBase & { type: "polygon" };

export type CircleMapping = MappingBase & { type: "circle" };

export type TextMapping = MappingBase & {
  type: "text";
  text: string;
  fontSize: number;
};

export type SpecialMapping = MappingBase & {
  type: "special";
  kind: string;
  /** Definition version used to migrate persisted config safely. */
  version?: number;
  config: Record<string, unknown>;
};

export type Mapping = PolygonMapping | CircleMapping | TextMapping | SpecialMapping;

export type Space = {
  id: string;
  name: string;
  mappings: Mapping[];
  surfaces: Surface[];
  updatedAt: number;
};

export function isSpecialMapping(mapping: Mapping): mapping is SpecialMapping {
  return mapping.type === "special";
}

export type ContextMenuState = {
  x: number;
  y: number;
  canvasX: number;
  canvasY: number;
  mappingId: string | null;
  surfaceId: string | null;
  colorMode: boolean;
};

export type DisplayInfo = {
  id: number;
  label: string;
  bounds: { x: number; y: number; width: number; height: number };
  primary: boolean;
};

export type RoomAPI = {
  getDisplays: () => Promise<DisplayInfo[]>;
  openOutput: (displayId?: number) => Promise<void>;
  closeOutput: () => Promise<void>;
  onOutputClosed: (callback: () => void) => () => void;
  onUndo: (callback: () => void) => () => void;
  onRedo: (callback: () => void) => () => void;
  sync: (payload: unknown) => void;
  onSync: (callback: (payload: unknown) => void) => () => void;
};

export type SyncPayload = {
  mappings: Mapping[];
  /** Ephemeral, definition-owned state. Never persisted or added to undo history. */
  runtime?: Record<string, unknown>;
};

declare global {
  interface Window {
    room?: RoomAPI;
  }
}
