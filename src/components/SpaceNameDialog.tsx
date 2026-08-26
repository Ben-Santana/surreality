import { useEffect, useRef, useState } from "react";
import { nextSpaceName, useRoomStore } from "../store";

export default function SpaceNameDialog() {
  const prompt = useRoomStore((state) => state.spaceNamePrompt);
  const spaces = useRoomStore((state) => state.spaces);
  const closeSpaceNamePrompt = useRoomStore((state) => state.closeSpaceNamePrompt);
  const confirmSpaceName = useRoomStore((state) => state.confirmSpaceName);
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!prompt) return;
    setName("");
    const id = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [prompt]);

  if (!prompt) return null;

  const submit = () => {
    if (!name.trim()) return;
    confirmSpaceName(name);
  };

  return (
    <div className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-black/55">
      <div className="editor-panel analog-frame w-[min(360px,calc(100vw-48px))] border border-white/10 bg-[#111114] p-5 text-white shadow-2xl shadow-black/50">
        <p className="chrome-label">{prompt === "save-as" ? "Save as" : "Name space"}</p>
        <p className="mt-2 text-[13px] leading-relaxed text-white/50">
          {prompt === "save-as" ? "Save a copy of this room as a new space." : "Give this space a name to save it."}
        </p>
        <input
          ref={inputRef}
          value={name}
          placeholder={nextSpaceName(spaces)}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.stopPropagation();
              submit();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              closeSpaceNamePrompt();
            }
          }}
          className="panel-field no-drag mt-4 h-9 w-full rounded-none px-3 text-[13px] outline-none"
        />
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            className="flex h-9 items-center justify-center border border-white/15 text-[13px] text-white/70 hover:bg-white/10 hover:text-white"
            onClick={closeSpaceNamePrompt}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!name.trim()}
            className="flex h-9 items-center justify-center border border-accent/40 bg-accent/15 text-[13px] text-white hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={submit}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
