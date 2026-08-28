import {
  ChevronDown,
  Circle,
  Frame,
  Grid3x3,
  Magnet,
  Monitor,
  MousePointer2,
  Pentagon,
  Plus,
  Presentation,
  Redo2,
  Sparkles,
  PackagePlus,
  Type,
  Undo2,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { importCustomMappingPackage, useCustomMappings } from "../customMappings/registry";
import { useRoomStore } from "../store";
import type { DisplayInfo, GridSize, Tool } from "../types";
import Flyout, { eventInside } from "./Flyout";
import SpacesMenu from "./SpacesMenu";

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

export default function Toolbar() {
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
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [menu, setMenu] = useState<MenuId | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customSide, setCustomSide] = useState<"left" | "right">("right");
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const customMappings = useCustomMappings();
  const addRef = useRef<HTMLDivElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const customRowRef = useRef<HTMLDivElement>(null);
  const customMenuRef = useRef<HTMLDivElement>(null);
  const gridSizeRef = useRef<HTMLDivElement>(null);
  const gridMenuRef = useRef<HTMLDivElement>(null);
  const projectorRef = useRef<HTMLDivElement>(null);
  const projectorMenuRef = useRef<HTMLDivElement>(null);
  const customCloseTimer = useRef<number>(0);
  const createActive = tool !== "select" && editMode;

  const toggleMenu = (id: MenuId) => {
    setCustomOpen(false);
    setMenu((current) => (current === id ? null : id));
  };

  const closeMenus = () => {
    setMenu(null);
    setCustomOpen(false);
  };

  const openCustom = () => {
    window.clearTimeout(customCloseTimer.current);
    const row = customRowRef.current?.getBoundingClientRect();
    if (row) {
      setCustomSide(row.right + 232 < window.innerWidth ? "right" : "left");
    }
    setCustomOpen(true);
  };

  const closeCustomSoon = () => {
    window.clearTimeout(customCloseTimer.current);
    customCloseTimer.current = window.setTimeout(() => setCustomOpen(false), 250);
  };

  const showNotice = (tone: "success" | "error", message: string) => {
    setNotice({ tone, message });
    window.setTimeout(() => setNotice(null), 4500);
  };

  const importPackage = async () => {
    if (importing) return;
    setImporting(true);
    closeMenus();
    try {
      const result = await importCustomMappingPackage();
      if (result && !result.canceled) {
        showNotice("success", `${result.installed.manifest.name} ${result.installed.manifest.version} installed.`);
      }
    } catch (error) {
      showNotice(
        "error",
        error instanceof Error ? error.message : "The custom mapping could not be installed.",
      );
    } finally {
      setImporting(false);
    }
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
          customRowRef.current,
          customMenuRef.current,
        ) &&
        menu === "add"
      ) {
        setMenu(null);
        setCustomOpen(false);
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
      window.clearTimeout(customCloseTimer.current);
    };
  }, [menu]);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {notice ? (
        <div
          role="status"
          className={`fixed right-5 top-5 z-[120] max-w-sm border px-4 py-3 text-[12px] shadow-2xl backdrop-blur ${
            notice.tone === "success"
              ? "border-emerald-400/35 bg-emerald-950/95 text-emerald-100"
              : "border-red-400/35 bg-red-950/95 text-red-100"
          }`}
        >
          {notice.message}
        </div>
      ) : null}
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
            <div
              ref={customRowRef}
              onMouseEnter={openCustom}
              onMouseLeave={closeCustomSoon}
            >
              <button
                type="button"
                title="Custom mappings (M)"
                className={`flex h-8 w-full items-center gap-2 rounded-none px-2 text-left text-[13px] hover:bg-white/10 ${
                  tool === "custom" && editMode ? "bg-accent/15 text-accent" : "text-white"
                }`}
                onClick={openCustom}
              >
                <Sparkles className="size-4 shrink-0 opacity-80" />
                <span className="min-w-0 flex-1 whitespace-nowrap">Custom Mappings</span>
                <span className="font-mono text-[10px] text-white/35">M</span>
                <span className="text-white/35">›</span>
              </button>
            </div>
            <Flyout
              open={customOpen}
              anchorRef={customRowRef}
              contentRef={customMenuRef}
              placement={customSide === "right" ? "right-start" : "left-start"}
              offset={0}
              className="w-72"
            >
              <div
                className="overflow-hidden rounded-none border border-white/10 bg-[#111114] shadow-2xl"
                onMouseEnter={openCustom}
                onMouseLeave={closeCustomSoon}
              >
                <div className="border-b border-white/10 px-3 py-2.5">
                  <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-accent">Custom Mappings</p>
                  <p className="mt-1 text-[11px] text-white/40">Installed code-powered mappings</p>
                </div>
                <div className="max-h-72 overflow-y-auto p-1">
                  {customMappings.map((item) => (
                    <button
                      key={`${item.manifest.id}@${item.manifest.version}`}
                      type="button"
                      className={`flex w-full items-start gap-2 rounded-none px-2.5 py-2 text-left hover:bg-white/10 ${
                        tool === "custom" && customMappingPackageId === item.manifest.id
                          ? "bg-accent/15 text-accent"
                          : ""
                      }`}
                      onClick={() => {
                        setCustomMappingPackage(item.manifest.id);
                        closeMenus();
                      }}
                    >
                      <Sparkles className="mt-0.5 size-3.5 shrink-0 text-white/45" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="truncate text-[13px] text-white">{item.manifest.name}</span>
                          <span className="shrink-0 font-mono text-[9px] text-white/30">v{item.manifest.version}</span>
                        </span>
                        <span className="mt-0.5 block truncate text-[10px] text-white/40">{item.manifest.description}</span>
                      </span>
                    </button>
                  ))}
                </div>
                <div className="border-t border-white/10 p-1">
                <button
                  type="button"
                  disabled={importing}
                  className="flex h-10 w-full items-center gap-2 px-2.5 text-left text-[12px] text-white/70 hover:bg-white/10 hover:text-white disabled:cursor-wait disabled:opacity-50"
                  onClick={() => void importPackage()}
                >
                  <PackagePlus className="size-4 shrink-0" />
                  {importing ? "Opening package…" : "Import .roommapping…"}
                </button>
                </div>
              </div>
            </Flyout>
          </div>
        </Flyout>
      </div>

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

      <div className="mx-2 h-5 w-px bg-white/15" />

      <SpacesMenu />

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
    </div>
  );
}
