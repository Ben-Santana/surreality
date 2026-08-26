import { useEffect, useMemo } from "react";
import Editor from "./components/Editor";
import OutputView from "./components/OutputView";
import { useShipPlayStore } from "./specials/ship/playStore";
import { onSoundPulse } from "./specials/sound/player";
import { useRoomStore } from "./store";
import { displayMappings } from "./wall";

export default function App() {
  const output = new URLSearchParams(window.location.search).get("mode") === "output";
  const mappings = useRoomStore((state) => state.mappings);
  const surfaces = useRoomStore((state) => state.surfaces);
  const shown = useMemo(() => displayMappings(mappings, surfaces), [mappings, surfaces]);
  const bullets = useShipPlayStore((state) => state.bullets);
  const charges = useShipPlayStore((state) => state.charges);
  const exhaust = useShipPlayStore((state) => state.exhaust);

  useEffect(() => {
    if (output) return;
    window.room?.sync({
      mappings: shown,
      shipPlay: {
        bullets,
        charges: Object.entries(charges).map(([id, charge]) => ({ id, charge })),
        exhaust,
      },
    });
  }, [output, shown, bullets, charges, exhaust]);

  useEffect(() => {
    if (output) return;
    return onSoundPulse((id) => {
      const play = useShipPlayStore.getState();
      window.room?.sync({
        mappings: shown,
        shipPlay: {
          bullets: play.bullets,
          charges: Object.entries(play.charges).map(([shipId, charge]) => ({
            id: shipId,
            charge,
          })),
          exhaust: play.exhaust,
        },
        soundPulse: { id, at: performance.now() },
      });
    });
  }, [output, shown]);

  return output ? <OutputView /> : <Editor />;
}
