import { Check, ChevronDown, Copy, Plus, Save, SquareStack, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { isUntitledSpace, spaceLabel, useRoomStore } from "../store";
import Flyout, { eventInside } from "./Flyout";

export default function SpacesMenu() {
  const spaces = useRoomStore((state) => state.spaces);
  const activeSpaceId = useRoomStore((state) => state.activeSpaceId);
  const isSpaceDirty = useRoomStore((state) => state.isSpaceDirty);
  const requestSave = useRoomStore((state) => state.requestSave);
  const requestSaveAs = useRoomStore((state) => state.requestSaveAs);
  const loadSpace = useRoomStore((state) => state.loadSpace);
  const deleteSpace = useRoomStore((state) => state.deleteSpace);
  const createBlankSpace = useRoomStore((state) => state.createBlankSpace);
  const mappings = useRoomStore((state) => state.mappings);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const active = spaces.find((space) => space.id === activeSpaceId) ?? null;
  const dirty = isSpaceDirty();

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!eventInside(event, ref.current, menuRef.current)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const confirmLeave = () => {
    if (!active || isUntitledSpace(active) || !dirty) return true;
    return window.confirm("Replace the current room? Unsaved space changes will be lost.");
  };

  const load = (id: string) => {
    if (id === activeSpaceId) {
      setOpen(false);
      return;
    }
    if (!confirmLeave()) return;
    loadSpace(id);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        title="Spaces"
        onClick={() => setOpen((value) => !value)}
        className={`flex h-8 items-center gap-2 rounded-none px-2.5 text-[13px] transition ${
          open ? "bg-accent text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
        }`}
      >
        <SquareStack className="size-4" />
        <span className="hidden max-w-28 truncate sm:inline">
          {`${spaceLabel(active)}${dirty ? "*" : ""}`}
        </span>
        <ChevronDown className="size-3 opacity-70" />
      </button>

      <Flyout open={open} anchorRef={ref} contentRef={menuRef} className="w-72">
        <div className="rounded-none border border-white/10 bg-[#111114] p-2 shadow-2xl">
            <button
              type="button"
              className="mb-1 flex h-8 w-full items-center gap-2 px-2 text-[13px] text-white hover:bg-white/10"
              onClick={() => {
                if (!confirmLeave()) return;
                createBlankSpace();
                setOpen(false);
              }}
            >
              <Plus className="size-3.5" />
              New space
            </button>

            <div className="mb-2 grid grid-cols-2 gap-1">
              <button
                type="button"
                className="flex h-8 items-center justify-center gap-1.5 rounded-none border border-white/15 text-[12px] text-white hover:bg-white/10"
                onClick={() => {
                  requestSave();
                  setOpen(false);
                }}
              >
                <Save className="size-3.5" />
                Save
              </button>
              <button
                type="button"
                className="flex h-8 items-center justify-center gap-1.5 rounded-none border border-white/15 text-[12px] text-white hover:bg-white/10"
                onClick={() => {
                  requestSaveAs();
                  setOpen(false);
                }}
              >
                <Copy className="size-3.5" />
                Save as
              </button>
            </div>

            {spaces.length === 0 ? (
              <p className="px-2 py-3 text-[13px] leading-relaxed text-white/45">
                Save this room as a space to switch back to it later.
              </p>
            ) : (
              <div className="max-h-56 overflow-auto border-t border-white/10 pt-1">
                {[...spaces]
                  .sort((left, right) => right.updatedAt - left.updatedAt)
                  .map((space) => {
                    const selected = space.id === activeSpaceId;
                    return (
                      <div
                        key={space.id}
                        className={`flex items-center gap-1 ${selected ? "bg-accent/15" : ""}`}
                      >
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-2 rounded-none px-2 py-2 text-left hover:bg-white/10"
                          onClick={() => load(space.id)}
                        >
                          {selected ? (
                            <Check className="size-3.5 shrink-0 text-accent" />
                          ) : (
                            <span className="size-3.5 shrink-0" />
                          )}
                          <span className="min-w-0 flex-1 truncate text-[13px] text-white">
                            {spaceLabel(space)}
                            {selected && dirty ? "*" : ""}
                          </span>
                          <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-white/35">
                            {String(
                              (selected ? mappings.length : space.mappings.length),
                            ).padStart(2, "0")}
                          </span>
                        </button>
                        <button
                          type="button"
                          title={`Delete ${spaceLabel(space)}`}
                          className="mr-1 flex size-7 shrink-0 items-center justify-center text-white/40 hover:bg-danger/15 hover:text-danger"
                          onClick={() => {
                            if (!window.confirm(`Delete space “${spaceLabel(space)}”?`)) return;
                            deleteSpace(space.id);
                            if (space.id === activeSpaceId) setOpen(false);
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}

            <p className="px-1 pt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-white/30">
              {isUntitledSpace(active) ? "Unnamed" : dirty ? "Unsaved changes" : "Saved"}
              {" · ⌘S"}
            </p>
        </div>
      </Flyout>
    </div>
  );
}
