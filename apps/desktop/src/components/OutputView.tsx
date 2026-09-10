import { useEffect, useRef, useState } from "react";
import { activateMapping, interactiveCustomMappingAt } from "../interact";
import { applyRuntimeSnapshots, CustomMappingRuntimeOverlays } from "../customMappings/runtime";
import type { Mapping, SyncPayload } from "../types";
import MappingCanvas, { canvasPoint } from "./MappingCanvas";
import MappingLayers from "./MappingLayers";

export default function OutputView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mappings, setMappings] = useState<Mapping[]>([]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") void window.room?.closeOutput();
    };
    window.addEventListener("keydown", onKey);
    const unsubscribe = window.room?.onSync((payload) => {
      const data = payload as SyncPayload;
      setMappings(data.mappings ?? []);
      (window as Window & { __roomMappings?: Mapping[] }).__roomMappings = data.mappings ?? [];
      applyRuntimeSnapshots(data.runtime);
    });
    return () => {
      window.removeEventListener("keydown", onKey);
      unsubscribe?.();
    };
  }, []);

  const pointFromEvent = (event: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvasPoint(event, canvas);
  };

  return (
    <div className="presentation-cursor relative h-screen w-screen bg-black">
      <MappingCanvas
        canvasRef={canvasRef}
        mappings={[]}
        className="block h-full w-full cursor-none"
        onPointerDown={(event) => {
          const point = pointFromEvent(event);
          if (!point) return;
          const pad = interactiveCustomMappingAt(mappings, point);
          if (pad) activateMapping(pad);
        }}
      />
      <MappingLayers mappings={mappings} />
      <CustomMappingRuntimeOverlays />
    </div>
  );
}
