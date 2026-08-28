import { spaceLabel, useRoomStore } from "../store";

export default function StatusBar() {
  const mappings = useRoomStore((state) => state.mappings);
  const surfaces = useRoomStore((state) => state.surfaces);
  const editMode = useRoomStore((state) => state.editMode);
  const tool = useRoomStore((state) => state.tool);
  const selectedId = useRoomStore((state) => state.selectedId);
  const spaces = useRoomStore((state) => state.spaces);
  const activeSpaceId = useRoomStore((state) => state.activeSpaceId);
  const isSpaceDirty = useRoomStore((state) => state.isSpaceDirty);
  const selected =
    mappings.find((mapping) => mapping.id === selectedId) ??
    surfaces.find((surface) => surface.id === selectedId);
  const activeSpace = spaces.find((space) => space.id === activeSpaceId);
  const dirty = isSpaceDirty();

  return (
    <div className="flex min-h-8 items-center gap-3 overflow-hidden whitespace-nowrap py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-white/45">
      <span className={editMode ? "text-accent" : "text-warm"}>
        {editMode ? "Edit" : "Present"}
      </span>
      <span className={dirty ? "text-warm" : undefined}>
        {`${spaceLabel(activeSpace)}${dirty ? "*" : ""}`}
      </span>
      <span>{String(mappings.length).padStart(2, "0")} mappings</span>
      <span>{selected ? selected.name : "No selection"}</span>
      <span>{tool}</span>
      <span className="tracking-[0.12em] text-white/35">RMB · Space · Esc</span>
    </div>
  );
}
