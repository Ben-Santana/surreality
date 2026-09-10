import { useEffect, useRef, useState } from "react";
import { nextSpaceName, useRoomStore } from "../store";
import { UiButton, UiLabel, UiPanel } from "./ui/Chrome";

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
      <UiPanel role="dialog" aria-modal="true" className="editor-panel w-[min(360px,calc(100vw-48px))] p-5 shadow-2xl shadow-black/50">
        <UiLabel>{prompt === "save-as" ? "Save as" : "Name space"}</UiLabel>
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
          <UiButton
            type="button"
            className="h-9"
            onClick={closeSpaceNamePrompt}
          >
            Cancel
          </UiButton>
          <UiButton
            tone="primary"
            type="button"
            disabled={!name.trim()}
            className="h-9"
            onClick={submit}
          >
            Save
          </UiButton>
        </div>
      </UiPanel>
    </div>
  );
}
