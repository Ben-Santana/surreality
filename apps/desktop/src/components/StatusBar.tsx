import { spaceLabel, useRoomStore } from "../store";
import { showAuthDialog, useCloudState } from "../cloud";

export default function StatusBar() {
  const mappings = useRoomStore((state) => state.mappings);
  const surfaces = useRoomStore((state) => state.surfaces);
  const editMode = useRoomStore((state) => state.editMode);
  const selectedId = useRoomStore((state) => state.selectedId);
  const spaces = useRoomStore((state) => state.spaces);
  const activeSpaceId = useRoomStore((state) => state.activeSpaceId);
  const isSpaceDirty = useRoomStore((state) => state.isSpaceDirty);
  const cloud = useCloudState();
  const selected =
    mappings.find((mapping) => mapping.id === selectedId) ??
    surfaces.find((surface) => surface.id === selectedId);
  const activeSpace = spaces.find((space) => space.id === activeSpaceId);
  const dirty = isSpaceDirty();

  return (
    <div className="flex min-h-8 items-center gap-3 overflow-hidden whitespace-nowrap py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/45">
      <span className={editMode ? "text-accent" : "text-warm"}>
        {editMode ? "Edit" : "Present"}
      </span>
      <span className={dirty ? "text-warm" : undefined}>
        {`${spaceLabel(activeSpace)}${dirty ? "*" : ""}`}
      </span>
      <span>{String(mappings.length).padStart(2, "0")} mappings</span>
      {selected ? <span className="truncate">{selected.name}</span> : null}
      <button type="button" onClick={showAuthDialog} className={`ml-auto ${cloud.user ? "text-accent/70" : "text-white/30"}`}>
        {cloud.profile?.username ? `@${cloud.profile.username}` : cloud.user ? "Set username" : "Community sign in"}
      </button>
    </div>
  );
}
