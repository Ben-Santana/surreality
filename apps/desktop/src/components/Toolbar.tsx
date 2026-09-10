import {
  ChevronDown,
  Circle,
  Frame,
  Film,
  Grid3x3,
  Magnet,
  Monitor,
  MousePointer2,
  Pentagon,
  Plus,
  Presentation,
  Redo2,
  Save,
  Shapes,
  Type,
  Undo2,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CORE_MEDIA_PACKAGE_ID } from "../customMappings/registry";
import { useRoomStore } from "../store";
import type { DisplayInfo, GridSize, Tool } from "../types";
import Flyout, { eventInside } from "./Flyout";

const createTools: { id: Exclude<Tool, "select" | "custom">; label: string; shortcut: string; icon: ReactNode }[] = [
  { id: "surface", label: "Surface", shortcut: "R", icon: <Frame className="size-4" /> },
  { id: "polygon", label: "Polygon", shortcut: "P", icon: <Pentagon className="size-4" /> },
  { id: "circle", label: "Circle", shortcut: "C", icon: <Circle className="size-4" /> },
  { id: "text", label: "Text", shortcut: "T", icon: <Type className="size-4" /> },
];

const gridSizes: { id: GridSize; label: string }[] = [
  { id: "small", label: "Small" },
  { id: "medium", label: "Medium" },
  { id: "large", label: "Large" },
];

type MenuId = "add" | "grid" | "projector";

export default function Toolbar({ onOpenCustomMappings, compact = false }: { onOpenCustomMappings: () => void; compact?: boolean }) {
  const tool = useRoomStore((state) => state.tool);
  const setTool = useRoomStore((state) => state.setTool);
  const customMappingPackageId = useRoomStore((state) => state.customMappingPackageId);
  const setCustomMappingPackage = useRoomStore((state) => state.setCustomMappingPackage);
  const editMode = useRoomStore((state) => state.editMode);
  const setEditMode = useRoomStore((state) => state.setEditMode);
  const showGrid = useRoomStore((state) => state.showGrid);
  const toggleGrid = useRoomStore((state) => state.toggleGrid);
  const snapToGrid = useRoomStore((state) => state.snapToGrid);
  const toggleSnapToGrid = useRoomStore((state) => state.toggleSnapToGrid);
  const gridSize = useRoomStore((state) => state.gridSize);
  const setGridSize = useRoomStore((state) => state.setGridSize);
  const projectorOpen = useRoomStore((state) => state.projectorOpen);
  const setProjectorOpen = useRoomStore((state) => state.setProjectorOpen);
  const canUndo = useRoomStore((state) => state.past.length > 0);
  const canRedo = useRoomStore((state) => state.future.length > 0);
  const undo = useRoomStore((state) => state.undo);
  const redo = useRoomStore((state) => state.redo);
  const requestSave = useRoomStore((state) => state.requestSave);
  const spaceDirty = useRoomStore((state) => state.isSpaceDirty());
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [menu, setMenu] = useState<MenuId | null>(null);
  const addRef = useRef<HTMLDivElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const gridSizeRef = useRef<HTMLDivElement>(null);
  const gridMenuRef = useRef<HTMLDivElement>(null);
  const projectorRef = useRef<HTMLDivElement>(null);
  const projectorMenuRef = useRef<HTMLDivElement>(null);
  const createActive = tool !== "select" && editMode;

  const toggleMenu = (id: MenuId) => {
    setMenu((current) => (current === id ? null : id));
  };

  const closeMenus = () => {
    setMenu(null);
  };

  useEffect(() => {
    void window.room?.getDisplays().then(setDisplays);
    return window.room?.onOutputClosed(() => setProjectorOpen(false));
  }, [setProjectorOpen]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (
        !eventInside(
          event,
          addRef.current,
          addMenuRef.current,
        ) &&
        menu === "add"
      ) {
        setMenu(null);
      }
      if (!eventInside(event, gridSizeRef.current, gridMenuRef.current) && menu === "grid") {
        setMenu(null);
      }
      if (!eventInside(event, projectorRef.current, projectorMenuRef.current) && menu === "projector") {
        setMenu(null);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [menu]);

  return (
    <div className={compact ? "compact-toolbar flex items-center gap-1" : "flex flex-wrap items-center gap-1"}>
      <button
        type="button"
        title="Select (V)"
        onClick={() => setTool("select")}
        className={`flex h-8 items-center gap-2 rounded-none px-2.5 text-[13px] transition ${
          tool === "select" && editMode
            ? "bg-accent text-white"
            : "text-white/70 hover:bg-white/10 hover:text-white"
        }`}
      >
        <MousePointer2 className="size-4" />
        <span className="hidden sm:inline">Select</span>
      </button>

      <div className="relative" ref={addRef}>
        <button
          type="button"
          title="Add mapping"
          onClick={() => toggleMenu("add")}
          className={`flex h-8 items-center gap-2 rounded-none px-2.5 text-[13px] transition ${
            createActive || menu === "add"
              ? "bg-accent text-white"
              : "text-white/70 hover:bg-white/10 hover:text-white"
          }`}
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline">Add</span>
          <ChevronDown className="size-3 opacity-70" />
        </button>
        <Flyout open={menu === "add"} anchorRef={addRef} contentRef={addMenuRef} className="w-60">
          <div className="overflow-visible rounded-none border border-white/10 bg-[#111114] p-1 shadow-2xl">
            <p className="px-2 pb-1 pt-1.5 font-mono text-[9px] uppercase tracking-[0.22em] text-white/35">
              Basic
            </p>
            {createTools.map((item) => (
              <button
                key={item.id}
                type="button"
                title={`${item.label} (${item.shortcut})`}
                className={`flex h-8 w-full items-center gap-2 rounded-none px-2 text-left text-[13px] hover:bg-white/10 ${
                  tool === item.id && editMode ? "bg-accent/15 text-accent" : "text-white"
                }`}
                onClick={() => {
                  setTool(item.id);
                  closeMenus();
                }}
              >
                <span className="opacity-80">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                <span className="font-mono text-[10px] text-white/35">{item.shortcut}</span>
              </button>
            ))}
            <button
              type="button"
              title="Media"
              className={`flex h-8 w-full items-center gap-2 rounded-none px-2 text-left text-[13px] hover:bg-white/10 ${
                tool === "custom" && customMappingPackageId === CORE_MEDIA_PACKAGE_ID && editMode
                  ? "bg-accent/15 text-accent"
                  : "text-white"
              }`}
              onClick={() => {
                setCustomMappingPackage(CORE_MEDIA_PACKAGE_ID);
                closeMenus();
              }}
            >
              <Film className="size-4 opacity-80" />
              <span className="flex-1">Media</span>
            </button>
            <button
              type="button"
              title="Browse custom mappings (M)"
              className={`flex h-8 w-full items-center gap-2 rounded-none px-2 text-left text-[13px] hover:bg-white/10 ${
                tool === "custom" && customMappingPackageId !== CORE_MEDIA_PACKAGE_ID && editMode
                  ? "bg-accent/15 text-accent"
                  : "text-white"
              }`}
              onClick={() => {
                closeMenus();
                onOpenCustomMappings();
              }}
            >
              <Shapes className="size-4 shrink-0 opacity-80" />
              <span className="min-w-0 flex-1 whitespace-nowrap">Custom Mappings</span>
              <span className="font-mono text-[10px] text-white/35">M</span>
            </button>
          </div>
        </Flyout>
      </div>

      {!compact && <>
      <div className="mx-2 h-5 w-px bg-white/15" />

      <button
        type="button"
        title="Undo (⌘Z)"
        disabled={!canUndo}
        onClick={undo}
        className={`flex size-8 items-center justify-center rounded-none transition ${
          canUndo
            ? "text-white/70 hover:bg-white/10 hover:text-white"
            : "cursor-not-allowed text-white/25"
        }`}
      >
        <Undo2 className="size-4" />
      </button>

      <button
        type="button"
        title="Redo (⇧⌘Z)"
        disabled={!canRedo}
        onClick={redo}
        className={`flex size-8 items-center justify-center rounded-none transition ${
          canRedo
            ? "text-white/70 hover:bg-white/10 hover:text-white"
            : "cursor-not-allowed text-white/25"
        }`}
      >
        <Redo2 className="size-4" />
      </button>

      <button
        type="button"
        title="Save (⌘S)"
        onClick={requestSave}
        className={`flex h-8 items-center gap-2 px-2.5 text-[13px] transition hover:bg-white/10 hover:text-white ${
          spaceDirty ? "text-accent" : "text-white/70"
        }`}
      >
        <Save className="size-4" />
        <span className="hidden sm:inline">Save</span>
      </button>

      <div className="mx-2 h-5 w-px bg-white/15" />

      <button
        type="button"
        title="Toggle grid (G)"
        onClick={toggleGrid}
        className={`flex size-8 items-center justify-center rounded-none transition ${
          showGrid ? "bg-accent text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
        }`}
      >
        <Grid3x3 className="size-4" />
      </button>

      <button
        type="button"
        title={showGrid ? "Snap to grid" : "Enable the grid to snap"}
        disabled={!showGrid}
        onClick={toggleSnapToGrid}
        className={`flex size-8 items-center justify-center rounded-none transition ${
          !showGrid
            ? "cursor-not-allowed text-white/25"
            : snapToGrid
              ? "bg-accent text-white"
              : "text-white/70 hover:bg-white/10 hover:text-white"
        }`}
      >
        <Magnet className="size-4" />
      </button>

      <div className="relative" ref={gridSizeRef}>
        <button
          type="button"
          title="Grid size"
          onClick={() => toggleMenu("grid")}
          className={`flex h-8 items-center gap-1 rounded-none px-2 text-[13px] transition ${
            menu === "grid"
              ? "bg-accent text-white"
              : "text-white/70 hover:bg-white/10 hover:text-white"
          }`}
        >
          <span className="capitalize">{gridSize}</span>
          <ChevronDown className="size-3 opacity-70" />
        </button>
        <Flyout open={menu === "grid"} anchorRef={gridSizeRef} contentRef={gridMenuRef} className="w-32">
          <div className="rounded-none border border-white/10 bg-[#111114] p-1 shadow-2xl">
            {gridSizes.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`flex w-full items-center justify-between rounded-none px-3 py-2 text-left text-[13px] hover:bg-white/10 ${
                  gridSize === item.id ? "bg-accent/15 text-accent" : "text-white"
                }`}
                onClick={() => {
                  setGridSize(item.id);
                  closeMenus();
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </Flyout>
      </div>

      <button
        type="button"
        title="Present (Space)"
        onClick={() => setEditMode(!editMode)}
        className={`flex h-8 items-center gap-2 rounded-none px-2.5 text-[13px] transition ${
          !editMode ? "bg-accent text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
        }`}
      >
        <Presentation className="size-4" />
        <span className="hidden md:inline">{editMode ? "Present" : "Editing"}</span>
      </button>

      <div className="relative" ref={projectorRef}>
        <button
          type="button"
          title="Projector output"
          onClick={async () => {
            if (projectorOpen) {
              await window.room?.closeOutput();
              setProjectorOpen(false);
              closeMenus();
              return;
            }
            if (displays.length <= 1) {
              await window.room?.openOutput();
              setProjectorOpen(true);
              return;
            }
            toggleMenu("projector");
          }}
          className={`flex h-8 items-center gap-2 rounded-none px-2.5 text-[13px] transition ${
            projectorOpen ? "bg-accent text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
          }`}
        >
          <Monitor className="size-4" />
          <span className="hidden lg:inline">{projectorOpen ? "Close output" : "Projector"}</span>
        </button>

        <Flyout
          open={menu === "projector" && displays.length > 1}
          anchorRef={projectorRef}
          contentRef={projectorMenuRef}
          placement="bottom-end"
          className="w-64"
        >
          <div className="rounded-none border border-white/10 bg-[#111114] p-1 shadow-2xl">
            {displays.map((display) => (
              <button
                key={display.id}
                type="button"
                className="flex w-full items-center justify-between rounded-none px-3 py-2 text-left text-[13px] text-white hover:bg-white/10"
                onClick={async () => {
                  await window.room?.openOutput(display.id);
                  setProjectorOpen(true);
                  closeMenus();
                }}
              >
                <span>{display.label}</span>
                <span className="text-[11px] text-white/45">
                  {display.bounds.width}×{display.bounds.height}
                  {display.primary ? " · main" : ""}
                </span>
              </button>
            ))}
          </div>
        </Flyout>
      </div>
      </>}
    </div>
  );
}
