import { PanelTopClose } from "lucide-react";
import { useEffect } from "react";
import { useRoomStore } from "../store";
import RoomPanel from "./RoomPanel";

export default function ControlsWindow() {
  const mappings = useRoomStore((state) => state.mappings);
  const dock = () => {
    window.opener?.postMessage({
      type: "room-controls-closed",
      bounds: {
        x: window.screenX,
        y: window.screenY,
        width: window.outerWidth,
        height: window.outerHeight,
      },
    }, "*");
    window.close();
  };
  useEffect(() => {
    const channel = new BroadcastChannel("projection-mapping-room-controls-lifecycle");
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
      <header className="drag-region flex h-10 shrink-0 items-center border-b border-white/10 pl-20 pr-3">
        <p className="chrome-label">Room</p>
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
