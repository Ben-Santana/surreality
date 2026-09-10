import { useEffect, useRef, useState } from "react";
import { spaceLabel, useRoomStore } from "../store";

export default function InlineSpaceName({ className = "" }: { className?: string }) {
  const spaces = useRoomStore((state) => state.spaces);
  const activeSpaceId = useRoomStore((state) => state.activeSpaceId);
  const renameSpace = useRoomStore((state) => state.renameSpace);
  const activeSpace = spaces.find((space) => space.id === activeSpaceId);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(activeSpace?.name ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setName(activeSpace?.name ?? "");
  }, [activeSpace?.id, activeSpace?.name, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const cancel = () => {
    setName(activeSpace?.name ?? "");
    setEditing(false);
  };

  const finish = () => {
    const nextName = name.trim();
    if (activeSpace && nextName) renameSpace(activeSpace.id, nextName);
    else setName(activeSpace?.name ?? "");
    setEditing(false);
  };

  if (!activeSpace) return null;

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={name}
        maxLength={80}
        aria-label="Space name"
        placeholder="Untitled"
        className={`no-drag h-7 min-w-0 border-b border-accent bg-transparent px-1 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-white outline-none ${className}`}
        onPointerDown={(event) => event.stopPropagation()}
        onChange={(event) => setName(event.target.value)}
        onBlur={finish}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") cancel();
        }}
      />
    );
  }

  return (
    <button
      type="button"
      title="Rename space"
      aria-label={`Rename ${spaceLabel(activeSpace)}`}
      className={`no-drag block min-w-0 truncate text-center outline-none transition hover:text-white focus-visible:ring-1 focus-visible:ring-accent/70 ${className}`}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={() => {
        setName(activeSpace.name);
        setEditing(true);
      }}
    >
      {spaceLabel(activeSpace)}
    </button>
  );
}
