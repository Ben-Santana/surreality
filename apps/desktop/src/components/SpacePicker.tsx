import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { spaceLabel, useRoomStore } from "../store";

export default function SpacePicker() {
  const spaces = useRoomStore((state) => state.spaces);
  const loadSpace = useRoomStore((state) => state.loadSpace);
  const createBlankSpace = useRoomStore((state) => state.createBlankSpace);
  const [hydrated, setHydrated] = useState(() => useRoomStore.persist.hasHydrated());

  useEffect(() => {
    if (hydrated) return;
    return useRoomStore.persist.onFinishHydration(() => setHydrated(true));
  }, [hydrated]);

  const sorted = [...spaces].sort((left, right) => right.updatedAt - left.updatedAt);

  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center">
      <div className="editor-panel analog-frame w-[min(420px,calc(100vw-48px))] border border-white/10 bg-[#111114] text-white shadow-2xl shadow-black/50">
        <div className="border-b border-white/10 px-5 py-4">
          <p className="chrome-label">Spaces</p>
          <p className="mt-2 text-[13px] leading-relaxed text-white/50">
            Open a space or start a blank one.
          </p>
        </div>

        <div className="px-4 py-3">
          <button
            type="button"
            className="flex h-10 w-full items-center justify-center gap-2 border border-accent/40 bg-accent/15 text-[13px] text-white hover:bg-accent/25"
            onClick={createBlankSpace}
          >
            <Plus className="size-4" />
            New space
          </button>
        </div>

        <div className="max-h-[min(360px,50vh)] overflow-auto border-t border-white/10 px-2 py-2">
          {!hydrated ? (
            <p className="px-3 py-4 text-[13px] text-white/45">Loading…</p>
          ) : sorted.length === 0 ? (
            <p className="px-3 py-4 text-[13px] leading-relaxed text-white/45">
              No spaces yet. Create a new one to begin.
            </p>
          ) : (
            sorted.map((space) => (
              <button
                key={space.id}
                type="button"
                className="mb-0.5 flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-white/10"
                onClick={() => loadSpace(space.id)}
              >
                <span className="min-w-0 flex-1 truncate text-[13px] text-white">{spaceLabel(space)}</span>
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-white/35">
                  {String(space.mappings.length).padStart(2, "0")}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
