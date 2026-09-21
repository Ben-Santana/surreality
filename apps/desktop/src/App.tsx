import { useEffect, useMemo, useRef } from "react";
import Editor from "./components/Editor";
import OutputView from "./components/OutputView";
import ControlsWindow from "./components/ControlsWindow";
import { useControlsSync } from "./controlsSync";
import { useRuntimeSnapshots } from "./customMappings/runtime";
import { useRoomStore } from "./store";
import { displayMappings } from "./wall";
import { initializeCustomMappings } from "./customMappings/registry";
import { disposeCloud, initializeCloud } from "./cloud";
import AuthDialog from "./components/AuthDialog";
import { useRoomStoreHydrated } from "./useRoomStoreHydrated";

export default function App() {
  const mode = new URLSearchParams(window.location.search).get("mode");
  const output = mode === "output";
  const controls = mode === "controls";
  useControlsSync(output ? null : controls ? "controls" : "editor");
  const mappings = useRoomStore((state) => state.mappings);
  const surfaces = useRoomStore((state) => state.surfaces);
  const spaces = useRoomStore((state) => state.spaces);
  const activeSpaceId = useRoomStore((state) => state.activeSpaceId);
  const presentationCursor = useRoomStore((state) => state.presentationCursor);
  const shown = useMemo(() => displayMappings(mappings, surfaces), [mappings, surfaces]);
  const runtime = useRuntimeSnapshots();
  const hydrated = useRoomStoreHydrated();
  const startupTarget = useRef<string | null>(null);
  const startupSent = useRef(false);
  const startupChecked = useRef(false);

  useEffect(() => {
    if (output || controls || !hydrated || !window.room || startupChecked.current) return;
    startupChecked.current = true;
    void Promise.all([window.room.startup.shouldRun(), window.room.startup.getSettings()]).then(([shouldRun, settings]) => {
      if (!shouldRun || !settings.enabled) return;
      if (!settings.spaceId || !spaces.some((space) => space.id === settings.spaceId)) {
        startupSent.current = true;
        void window.room?.startup.cancel("The space selected for startup presentation no longer exists.");
        return;
      }
      startupTarget.current = settings.spaceId;
      useRoomStore.getState().loadSpace(settings.spaceId);
    });
  }, [controls, hydrated, output, spaces]);

  useEffect(() => {
    if (output || controls || startupSent.current || !startupTarget.current || activeSpaceId !== startupTarget.current) return;
    startupSent.current = true;
    void window.room?.startup.ready({ mappings: shown, cursor: presentationCursor, runtime });
  }, [activeSpaceId, controls, output, presentationCursor, runtime, shown]);

  useEffect(() => {
    void initializeCustomMappings();
  }, []);

  useEffect(() => {
    if (output || controls) return;
    void initializeCloud();
    const flush = () => { void window.room?.persistence.flush(); };
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      flush();
      disposeCloud();
    };
  }, [controls, output]);

  useEffect(() => {
    if (output || controls) return;
    window.room?.sync({
      mappings: shown,
      cursor: presentationCursor,
      runtime,
    });
  }, [controls, output, presentationCursor, shown, runtime]);

  if (output) return <OutputView />;
  if (controls) return <ControlsWindow />;
  return <><Editor /><AuthDialog /></>;
}
