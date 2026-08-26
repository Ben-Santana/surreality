import { useEffect, useRef, useState } from "react";
import { activateMapping, interactiveSpecialAt } from "../interact";
import { ShipBullets, ShipExhaust } from "../specials/ship/ShipBullets";
import { useShipPlayStore } from "../specials/ship/playStore";
import { emitSoundPulse } from "../specials/sound/player";
import type { Mapping, SyncPayload } from "../types";
import MappingCanvas, { canvasPoint } from "./MappingCanvas";
import SpecialOverlays from "./SpecialOverlays";

export default function OutputView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [hoverSound, setHoverSound] = useState(false);
  const [shipPlay, setShipPlay] = useState<SyncPayload["shipPlay"]>({ bullets: [] });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") void window.room?.closeOutput();
    };
    window.addEventListener("keydown", onKey);
    const unsubscribe = window.room?.onSync((payload) => {
      const data = payload as SyncPayload;
      setMappings(data.mappings ?? []);
      if (data.shipPlay) {
        setShipPlay(data.shipPlay);
        const charges: Record<string, number> = {};
        for (const item of data.shipPlay.charges ?? []) charges[item.id] = item.charge;
        useShipPlayStore.getState().setPlay({
          bullets: (data.shipPlay.bullets ?? []).map((bullet) => ({
            ...bullet,
            opacity: bullet.opacity ?? 1,
          })),
          charges,
          exhaust: data.shipPlay.exhaust ?? [],
        });
      }
      if (data.soundPulse) emitSoundPulse(data.soundPulse.id);
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
          const pad = interactiveSpecialAt(mappings, point);
          if (pad) activateMapping(pad);
        }}
        onPointerMove={(event) => {
          const point = pointFromEvent(event);
          setHoverSound(Boolean(point && interactiveSpecialAt(mappings, point)));
        }}
      />
      <ShipExhaust exhaust={shipPlay?.exhaust ?? []} />
      <SpecialOverlays mappings={mappings} />
      <ShipBullets bullets={shipPlay?.bullets ?? []} />
    </div>
  );
}
