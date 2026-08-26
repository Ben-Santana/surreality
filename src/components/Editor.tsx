import { useEffect } from "react";
import { useRoomStore } from "../store";
import ContextMenu from "./ContextMenu";
import FloatingPanel from "./FloatingPanel";
import Inspector from "./Inspector";
import LayerPanel from "./LayerPanel";
import SpaceNameDialog from "./SpaceNameDialog";
import SpacePicker from "./SpacePicker";
import Stage from "./Stage";
import StatusBar from "./StatusBar";
import Toolbar from "./Toolbar";
import { useShipRuntime } from "../specials/ship/runtime";

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

export default function Editor() {
  useShipRuntime();
  const mappings = useRoomStore((state) => state.mappings);
  const editMode = useRoomStore((state) => state.editMode);
  const contextMenu = useRoomStore((state) => state.contextMenu);
  const spaceEntered = useRoomStore((state) => state.spaceEntered);
  const setEditMode = useRoomStore((state) => state.setEditMode);
  const closeMenu = useRoomStore((state) => state.closeMenu);
  const setTool = useRoomStore((state) => state.setTool);
  const deleteSelected = useRoomStore((state) => state.deleteSelected);
  const duplicateSelected = useRoomStore((state) => state.duplicateSelected);
  const toggleGrid = useRoomStore((state) => state.toggleGrid);
  const select = useRoomStore((state) => state.select);
  const requestSave = useRoomStore((state) => state.requestSave);
  const undo = useRoomStore((state) => state.undo);
  const redo = useRoomStore((state) => state.redo);

  useEffect(() => {
    const runUndo = () => {
      if (useRoomStore.getState().spaceEntered) undo();
    };
    const runRedo = () => {
      if (useRoomStore.getState().spaceEntered) redo();
    };

    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (spaceEntered) requestSave();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) runRedo();
        else runUndo();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        runRedo();
        return;
      }

      if (!spaceEntered || isTypingTarget(event.target)) return;

      if (event.key === "Escape") {
        if (contextMenu) {
          closeMenu();
          return;
        }
        if (!editMode) {
          setEditMode(true);
          return;
        }
        select(null);
        return;
      }

      if (event.key === " " || event.code === "Space") {
        event.preventDefault();
        if (editMode && !event.repeat) setEditMode(false);
        return;
      }

      if ((event.key === "Delete" || event.key === "Backspace") && editMode) {
        deleteSelected();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateSelected();
        return;
      }

      if (event.metaKey || event.ctrlKey) return;
      if (!editMode) return;

      if (event.key.toLowerCase() === "v") setTool("select");
      if (event.key.toLowerCase() === "r") setTool("surface");
      if (event.key.toLowerCase() === "p") setTool("polygon");
      if (event.key.toLowerCase() === "c") setTool("circle");
      if (event.key.toLowerCase() === "t") setTool("text");
      if (event.key.toLowerCase() === "s") setTool("special");
      if (event.key.toLowerCase() === "g") toggleGrid();
    };

    window.addEventListener("keydown", onKey, true);
    const offUndo = window.room?.onUndo(runUndo);
    const offRedo = window.room?.onRedo(runRedo);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      offUndo?.();
      offRedo?.();
    };
  }, [
    closeMenu,
    contextMenu,
    deleteSelected,
    duplicateSelected,
    editMode,
    redo,
    requestSave,
    select,
    setEditMode,
    setTool,
    spaceEntered,
    toggleGrid,
    undo,
  ]);

  return (
    <div className="relative h-screen bg-black">
      {editMode ? (
        <div className="drag-region pointer-events-auto absolute left-0 top-0 z-50 h-12 w-[88px]" />
      ) : null}
      <Stage />
      {spaceEntered && editMode ? (
        <FloatingPanel
          title="Room"
          accessory={
            <span className="font-mono text-[11px] tracking-widest text-accent">
              {String(mappings.length).padStart(2, "0")}
            </span>
          }
        >
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="relative z-30 shrink-0 overflow-visible border-b border-white/10 px-1 py-1">
              <Toolbar />
            </div>
            <div className="flex min-h-0 flex-1 overflow-hidden">
              <section className="flex w-52 shrink-0 flex-col border-r border-white/10">
                <p className="chrome-label px-3 py-2">Mappings</p>
                <div className="min-h-0 flex-1 overflow-auto">
                  <LayerPanel />
                </div>
              </section>
              <section className="flex min-w-0 flex-1 flex-col">
                <p className="chrome-label px-4 py-2">Inspector</p>
                <div className="min-h-0 flex-1 overflow-auto">
                  <Inspector />
                </div>
              </section>
            </div>
            <div className="shrink-0 border-t border-white/10 px-3">
              <StatusBar />
            </div>
          </div>
        </FloatingPanel>
      ) : null}
      {spaceEntered ? <ContextMenu /> : <SpacePicker />}
      <SpaceNameDialog />
    </div>
  );
}
