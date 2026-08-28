import { ArrowLeft, PanelTopClose } from "lucide-react";
import { useEffect } from "react";
import { spaceLabel, useRoomStore } from "../store";
import RoomPanel from "./RoomPanel";

export default function ControlsWindow() {
  const mappings = useRoomStore((state) => state.mappings);
  const spaces = useRoomStore((state) => state.spaces);
  const activeSpaceId = useRoomStore((state) => state.activeSpaceId);
  const activeSpace = spaces.find((space) => space.id === activeSpaceId);
  const returnToSpacePicker = useRoomStore((state) => state.returnToSpacePicker);
  const bounds = () => ({
    x: window.screenX,
    y: window.screenY,
    width: window.outerWidth,
    height: window.outerHeight,
  });
  const dock = () => {
    window.opener?.postMessage({
      type: "room-controls-closed",
      bounds: bounds(),
    }, "*");
    window.close();
  };
  const showSpaces = () => {
    returnToSpacePicker();
    window.opener?.postMessage({ type: "room-controls-show-spaces", bounds: bounds() }, "*");
    window.close();
  };
  useEffect(() => {
    const channel = new BroadcastChannel("surreality-controls-lifecycle");
    channel.postMessage("opened");
    const closing = () => {
      window.opener?.postMessage({
        type: "room-controls-closed",
        bounds: {
          x: window.screenX,
          y: window.screenY,
          width: window.outerWidth,
          height: window.outerHeight,
        },
      }, "*");
      channel.postMessage("closed");
    };
    window.addEventListener("beforeunload", closing);
    return () => {
      window.removeEventListener("beforeunload", closing);
      channel.postMessage("closed");
      channel.close();
    };
  }, []);
  return (
    <div className="editor-panel flex h-screen flex-col bg-[#111114] text-white">
      <header className="drag-region flex h-10 shrink-0 items-center border-b border-white/10 px-3">
        <button
          type="button"
          title="Back to all spaces"
          aria-label={`Back to all spaces from ${spaceLabel(activeSpace)}`}
          className="group no-drag relative block h-4 min-w-[132px] max-w-52 overflow-hidden text-left outline-none focus-visible:ring-1 focus-visible:ring-accent/70"
          onClick={showSpaces}
        >
          <span className="chrome-label block truncate leading-4 transition-transform duration-200 ease-out group-hover:-translate-y-full group-focus-visible:-translate-y-full">
            {spaceLabel(activeSpace)}
          </span>
          <span className="absolute left-0 top-full flex items-center gap-2 font-mono text-[11px] uppercase leading-4 tracking-[0.22em] text-white transition-transform duration-200 ease-out group-hover:-translate-y-full group-focus-visible:-translate-y-full">
            <ArrowLeft className="size-3 shrink-0" />
            <span>All spaces</span>
          </span>
        </button>
        <span className="ml-auto font-mono text-[11px] tracking-widest text-accent">
          {String(mappings.length).padStart(2, "0")}
        </span>
        <button
          type="button"
          className="no-drag ml-3 flex size-7 items-center justify-center text-white/45 hover:bg-white/10 hover:text-white"
          onClick={dock}
          title="Return controls to the main window"
          aria-label="Dock controls in main window"
        >
          <PanelTopClose className="size-3.5" />
        </button>
      </header>
      <RoomPanel detached />
    </div>
  );
}
