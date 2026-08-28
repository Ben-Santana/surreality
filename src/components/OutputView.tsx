import { useEffect, useRef, useState } from "react";
import { activateMapping, interactiveCustomMappingAt } from "../interact";
import { applyRuntimeSnapshots, CustomMappingRuntimeOverlays } from "../customMappings/runtime";
import type { Mapping, SyncPayload } from "../types";
import MappingCanvas, { canvasPoint } from "./MappingCanvas";
import CustomMappingOverlays from "./CustomMappingOverlays";

export default function OutputView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [hoverSound, setHoverSound] = useState(false);

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
    <div className="relative h-screen w-screen bg-black">
      <MappingCanvas
        canvasRef={canvasRef}
        mappings={mappings}
        className={`block h-full w-full ${hoverSound ? "cursor-pointer" : "cursor-default"}`}
        onPointerDown={(event) => {
          const point = pointFromEvent(event);
          if (!point) return;
          const pad = interactiveCustomMappingAt(mappings, point);
          if (pad) activateMapping(pad);
        }}
        onPointerMove={(event) => {
          const point = pointFromEvent(event);
          setHoverSound(Boolean(point && interactiveCustomMappingAt(mappings, point)));
        }}
      />
      <CustomMappingOverlays mappings={mappings} />
      <CustomMappingRuntimeOverlays />
    </div>
  );
}
