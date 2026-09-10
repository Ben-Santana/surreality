export type Point = { x: number; y: number };

export type Rgba = { r: number; g: number; b: number; a: number };

export type Tool = "select" | "surface" | "polygon" | "circle" | "text" | "custom";

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

export const PANEL_SIZE = { width: 780, height: 516 };

export type MappingType = "polygon" | "circle" | "text" | "custom";

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

export type TextFontId = "chakra" | "technical" | "expression";

export type TextContentMode = "text" | "clock";
export type ClockStyle = "digital" | "analog";
export type ClockFaceStyle = "minimal" | "ticks" | "numerals";

export type TextMapping = MappingBase & {
  type: "text";
  text: string;
  /** Optional so text mappings saved before font choices were added still load. */
  fontFamily?: TextFontId;
  /** Optional clock fields keep older saved text mappings compatible. */
  contentMode?: TextContentMode;
  clockStyle?: ClockStyle;
  clockFaceStyle?: ClockFaceStyle;
  clock24Hour?: boolean;
  clockShowSeconds?: boolean;
  clockShowDate?: boolean;
  clockShowBackground?: boolean;
  clockGlow?: boolean;
};

export type CustomMapping = MappingBase & {
  type: "custom";
  /** Stable package identity, independent of the package's display name. */
  packageId: string;
  /** Exact package version used when this mapping was created. */
  packageVersion: string;
  /** Package-owned configuration schema version. */
  configVersion: number;
  config: Record<string, unknown>;
};

export type Mapping = PolygonMapping | CircleMapping | TextMapping | CustomMapping;

export type Space = {
  id: string;
  name: string;
  mappings: Mapping[];
  surfaces: Surface[];
  updatedAt: number;
};

export function isCustomMapping(mapping: Mapping): mapping is CustomMapping {
  return mapping.type === "custom";
}

/** @deprecated Bundled mappings still use this alias internally while moving to the public SDK. */
export type SpecialMapping = CustomMapping;

/** @deprecated Use isCustomMapping. */
export const isSpecialMapping = isCustomMapping;

export type CustomMappingGeometry = "quad" | "polygon" | "circle";

export type CustomMappingPermission =
  | "audio:play"
  | "camera:read"
  | "events:room"
  | "input:keyboard"
  | "input:pointer"
  | "microphone:read"
  | "network:fetch"
  | "storage:package"
  | "files:user-selected"
  | "device:usb"
  | "device:serial"
  | "device:camera"
  | "device:midi"
  | "network:listen"
  | "process:spawn"
  | "background:run"
  | "events:publish"
  | "system:unrestricted";

export type CustomMappingPackageManifest = {
  manifestVersion: 1 | 2;
  id: string;
  name: string;
  version: string;
  configVersion: number;
  description: string;
  author?: { name: string; url?: string };
  minimumAppVersion?: string;
  geometry: CustomMappingGeometry;
  contentSize: { width: number; height: number };
  defaultColor: Rgba;
  defaultConfig: Record<string, unknown>;
  entrypoints: { mapping: string; inspector?: string; runtime?: string; plugin?: string };
  permissions?: CustomMappingPermission[];
  thumbnail?: string;
  bundled?: boolean;
};

export type CustomMappingPackageRecord = {
  manifest: CustomMappingPackageManifest;
  source: "bundled" | "installed";
  installationSource?: "local" | "community";
  enabled: boolean;
};

export type CustomMappingImportResult =
  | { canceled: true }
  | { canceled: false; installed: CustomMappingPackageRecord };

export type CustomMappingUninstallResult = { removed: boolean };

export type LocalAsset = {
  id: string;
  sha256: string;
  source: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
};

export type AssetImportResult =
  | { canceled: true }
  | { canceled: false; asset: LocalAsset };

export type CloudState = {
  configured: boolean;
  user: { id: string; email: string | null } | null;
  profile: { username: string | null; isAdmin: boolean } | null;
  lastError: string | null;
};

export type CommunityReleaseStatus = "published" | "pending_review" | "rejected" | "taken_down";
export type CommunityRelease = {
  releaseId: string;
  packageId: string;
  version: string;
  manifest: CustomMappingPackageManifest;
  sha256: string;
  byteSize: number;
  publisherUsername: string;
  status: CommunityReleaseStatus;
  statusReason: string | null;
  approvedNative: boolean;
  publishedAt: string | null;
  createdAt: string;
  installed: boolean;
  owned?: boolean;
  thumbnailUrl?: string;
  listingName?: string;
  listingDescription?: string;
  saved?: boolean;
  installationSource?: "local" | "community";
  firstDownloadedAt?: string;
  lastDownloadedAt?: string;
  downloadCount?: number;
};

export type CommunityBrowseOptions = { search?: string; sort?: "newest" | "name"; cursor?: string };
export type CommunityBrowseResult = { items: CommunityRelease[]; nextCursor: string | null };
export type CommunityProgress = { operation: "upload" | "download"; releaseId?: string; percent: number; message: string };

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
  openControls: () => Promise<void>;
  closeControls: () => Promise<void>;
  isControlsOpen: () => Promise<boolean>;
  getControlsState: () => Promise<unknown>;
  onControlsClosed: (callback: () => void) => () => void;
  syncControls: (payload: unknown) => void;
  onControlsSync: (callback: (payload: unknown) => void) => () => void;
  onOutputClosed: (callback: () => void) => () => void;
  onUndo: (callback: () => void) => () => void;
  onRedo: (callback: () => void) => () => void;
  listCustomMappings: () => Promise<CustomMappingPackageRecord[]>;
  importCustomMapping: () => Promise<CustomMappingImportResult>;
  uninstallCustomMapping: (packageId: string, packageVersion: string) => Promise<CustomMappingUninstallResult>;
  onCustomMappingsChanged: (callback: () => void) => () => void;
  persistence: {
    getItem: (name: string) => Promise<string | null>;
    setItem: (name: string, value: string) => void;
    flush: () => Promise<void>;
  };
  importAsset: (kind: "media" | "audio") => Promise<AssetImportResult>;
  cloud: {
    configure: (url: string, publishableKey: string) => Promise<CloudState>;
    getState: () => Promise<CloudState>;
    signUp: (email: string, password: string) => Promise<{ needsEmailConfirmation: boolean; state: CloudState }>;
    signIn: (email: string, password: string) => Promise<CloudState>;
    signOut: () => Promise<CloudState>;
    sendPasswordReset: (email: string) => Promise<void>;
    recoverPassword: (email: string, token: string, newPassword: string) => Promise<CloudState>;
    onState: (callback: (state: CloudState) => void) => () => void;
  };
  community: {
    browse: (options: CommunityBrowseOptions) => Promise<CommunityBrowseResult>;
    getPackage: (packageId: string) => Promise<CommunityRelease[]>;
    listDownloads: () => Promise<CommunityRelease[]>;
    listSaved: () => Promise<CommunityRelease[]>;
    listUploads: () => Promise<CommunityRelease[]>;
    listModerationQueue: () => Promise<CommunityRelease[]>;
    setUsername: (username: string) => Promise<CloudState>;
    uploadFromFile: () => Promise<{ canceled: boolean; release?: CommunityRelease }>;
    chooseThumbnail: () => Promise<{ canceled: boolean; previewUrl?: string; thumbnail?: { mimeType: string; data: string } }>;
    updateListing: (releaseId: string, listing: { name: string; description: string; removeThumbnail?: boolean; thumbnail?: { mimeType: string; data: string } }) => Promise<{ thumbnailRemoved?: boolean; thumbnailUrl?: string }>;
    downloadAndInstall: (releaseId: string) => Promise<{ canceled: boolean; installed?: CustomMappingPackageRecord }>;
    report: (releaseId: string, reason: string) => Promise<void>;
    setSaved: (releaseId: string, saved: boolean) => Promise<void>;
    takeDown: (releaseId: string, reason?: string) => Promise<void>;
    restore: (releaseId: string) => Promise<void>;
    approve: (releaseId: string) => Promise<void>;
    reject: (releaseId: string, reason: string) => Promise<void>;
    onProgress: (callback: (progress: CommunityProgress) => void) => () => void;
    open: () => void;
    onOpen: (callback: () => void) => () => void;
  };
  onPluginData: (callback: (payload: PluginDataMessage) => void) => () => void;
  sync: (payload: unknown) => void;
  onSync: (callback: (payload: unknown) => void) => () => void;
};

export type PluginDataMessage = {
  packageId: string;
  channel: string;
  data: unknown;
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
