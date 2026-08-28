import { ExternalLink } from "lucide-react";
import Inspector from "./Inspector";
import LayerPanel from "./LayerPanel";
import StatusBar from "./StatusBar";
import Toolbar from "./Toolbar";

export default function RoomPanel({ detached = false }: { detached?: boolean }) {
  const detach = () => {
    if (detached) return;
    const panel = document.querySelector<HTMLElement>(".embedded-room-panel");
    const rect = panel?.getBoundingClientRect();
    const url = new URL(window.location.href);
    url.search = "?mode=controls";
    const popup = window.open(
      url,
      "room-controls",
      `popup,width=${Math.round(rect?.width ?? 760)},height=${Math.round(rect?.height ?? 720)},resizable=yes,left=${Math.round(window.screenX + (rect?.left ?? 0))},top=${Math.round(window.screenY + (rect?.top ?? 0))}`,
    );
    if (!popup) return;
    document.documentElement.classList.add("controls-detached");
    window.dispatchEvent(new CustomEvent("controls-window-opened", { detail: popup }));
    popup.focus();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative z-30 shrink-0 overflow-visible border-b border-white/10 px-1 py-1">
        <Toolbar />
      </div>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <section className="flex w-52 shrink-0 flex-col border-r border-white/10">
          <p className="chrome-label px-3 py-2">Mappings</p>
          <div className="min-h-0 flex-1 overflow-auto"><LayerPanel /></div>
        </section>
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-8 shrink-0 items-center px-4">
            <p className="chrome-label">Inspector</p>
            {!detached ? <button
              type="button"
              className="no-drag ml-auto flex size-7 items-center justify-center text-white/45 hover:bg-white/10 hover:text-white"
              onClick={detach}
              title="Move controls to a separate window"
              aria-label="Detach controls window"
            >
              <ExternalLink className="size-3.5" />
            </button> : null}
          </div>
          <div className="min-h-0 flex-1 overflow-auto"><Inspector /></div>
        </section>
      </div>
      <div className="shrink-0 border-t border-white/10 px-3"><StatusBar /></div>
    </div>
  );
}
