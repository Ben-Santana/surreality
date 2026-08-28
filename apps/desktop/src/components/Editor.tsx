import { useEffect, useState } from "react";
import { useRoomStore } from "../store";
import ContextMenu from "./ContextMenu";
import FloatingPanel from "./FloatingPanel";
import RoomPanel from "./RoomPanel";
import SpaceNameDialog from "./SpaceNameDialog";
import SpacePicker from "./SpacePicker";
import Stage from "./Stage";
import { CustomMappingRuntimeHosts } from "../customMappings/runtime";

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

export default function Editor() {
  const [controlsDetached, setControlsDetached] = useState(false);
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

  const detachControls = (bounds?: { x: number; y: number; width: number; height: number }) => {
    document.documentElement.classList.add("controls-detached");
    const url = new URL(window.location.href);
    url.search = "?mode=controls";
    const placement = bounds
      ? `,left=${bounds.x},top=${bounds.y}`
      : "";
    const popup = window.open(
      url,
      "room-controls",
      `popup,width=${bounds?.width ?? 760},height=${bounds?.height ?? 720},resizable=yes${placement}`,
    );
    window.dispatchEvent(new CustomEvent("controls-window-opened", { detail: popup }));
    popup?.focus();
  };

  useEffect(() => {
    document.documentElement.classList.remove("controls-detached");
    let popup: Window | null = null;
    const lifecycle = new BroadcastChannel("surreality-controls-lifecycle");
    lifecycle.onmessage = (event: MessageEvent<unknown>) => {
      if (event.data === "opened") {
        document.documentElement.classList.add("controls-detached");
        setControlsDetached(true);
      }
      if (event.data === "closed") {
        document.documentElement.classList.remove("controls-detached");
        setControlsDetached(false);
      }
    };
    const opened = (event: Event) => {
      popup = (event as CustomEvent<Window>).detail;
      setControlsDetached(true);
    };
    const closed = (event: MessageEvent<unknown>) => {
      const message = event.data as {
        type?: string;
        bounds?: { x: number; y: number; width: number; height: number };
      } | null;
      if (message?.type !== "room-controls-closed") return;
      const bounds = message.bounds;
      if (bounds) {
        const x = bounds.x - window.screenX;
        const y = bounds.y - window.screenY;
        useRoomStore.getState().setPanelLayout({
          corners: [
            { x, y },
            { x: x + bounds.width, y },
            { x: x + bounds.width, y: y + bounds.height },
            { x, y: y + bounds.height },
          ],
        });
      }
      popup = null;
      document.documentElement.classList.remove("controls-detached");
      setControlsDetached(false);
    };
    window.addEventListener("controls-window-opened", opened);
    window.addEventListener("message", closed);
    const timer = window.setInterval(() => {
      if (popup?.closed) {
        popup = null;
        document.documentElement.classList.remove("controls-detached");
        setControlsDetached(false);
      }
    }, 250);
    return () => {
      lifecycle.close();
      window.removeEventListener("controls-window-opened", opened);
      window.removeEventListener("message", closed);
      window.clearInterval(timer);
    };
  }, []);

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
      if (event.key.toLowerCase() === "m") setTool("custom");
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
      <CustomMappingRuntimeHosts />
      {editMode ? (
        <div className="drag-region pointer-events-auto absolute left-0 top-0 z-50 h-12 w-[88px]" />
      ) : null}
      <Stage />
      {spaceEntered && editMode && !controlsDetached ? (
        <FloatingPanel
          title="Room"
          className="embedded-room-panel"
          onDetach={detachControls}
          accessory={
            <span className="font-mono text-[11px] tracking-widest text-accent">
              {String(mappings.length).padStart(2, "0")}
            </span>
          }
        >
          <RoomPanel />
        </FloatingPanel>
      ) : null}
      {spaceEntered ? <ContextMenu /> : <SpacePicker />}
      <SpaceNameDialog />
    </div>
  );
}
