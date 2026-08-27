import { useEffect, useMemo } from "react";
import Editor from "./components/Editor";
import OutputView from "./components/OutputView";
import ControlsWindow from "./components/ControlsWindow";
import { useControlsSync } from "./controlsSync";
import { useRuntimeSnapshots } from "./specials/RuntimeHosts";
import { useRoomStore } from "./store";
import { displayMappings } from "./wall";

export default function App() {
  const mode = new URLSearchParams(window.location.search).get("mode");
  const output = mode === "output";
  const controls = mode === "controls";
  useControlsSync(output ? null : controls ? "controls" : "editor");
  const mappings = useRoomStore((state) => state.mappings);
  const surfaces = useRoomStore((state) => state.surfaces);
  const shown = useMemo(() => displayMappings(mappings, surfaces), [mappings, surfaces]);
  const runtime = useRuntimeSnapshots();

  useEffect(() => {
    if (output || controls) return;
    window.room?.sync({
      mappings: shown,
      runtime,
    });
  }, [controls, output, shown, runtime]);

  if (output) return <OutputView />;
  if (controls) return <ControlsWindow />;
  return <Editor />;
}
