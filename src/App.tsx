import { useEffect, useMemo } from "react";
import Editor from "./components/Editor";
import OutputView from "./components/OutputView";
import { useRuntimeSnapshots } from "./specials/RuntimeHosts";
import { useRoomStore } from "./store";
import { displayMappings } from "./wall";

export default function App() {
  const output = new URLSearchParams(window.location.search).get("mode") === "output";
  const mappings = useRoomStore((state) => state.mappings);
  const surfaces = useRoomStore((state) => state.surfaces);
  const shown = useMemo(() => displayMappings(mappings, surfaces), [mappings, surfaces]);
  const runtime = useRuntimeSnapshots();

  useEffect(() => {
    if (output) return;
    window.room?.sync({
      mappings: shown,
      runtime,
    });
  }, [output, shown, runtime]);

  return output ? <OutputView /> : <Editor />;
}
