import { rgbaCss } from "../../geometry";
import type { SpecialViewProps } from "../types";
import { defaultShipConfig, DOCK_RADIUS, SHIP_HULL, SHIP_NOSE, type ShipConfig } from "./config";
import { useShipPlayStore } from "./playStore";

const hullPoints = SHIP_HULL.map((point) => `${point.x},${point.y}`).join(" ");
// Tangency points from the ship's nose to the dock circle. Using one outline
// avoids the triangular hull showing through the circular dock.
const dockJoinY = -(DOCK_RADIUS * DOCK_RADIUS) / Math.abs(SHIP_NOSE.y);
const dockJoinX = Math.sqrt(DOCK_RADIUS * DOCK_RADIUS - dockJoinY * dockJoinY);
const dockedHullPath = [
  `M ${SHIP_NOSE.x} ${SHIP_NOSE.y}`,
  `L ${dockJoinX} ${dockJoinY}`,
  `A ${DOCK_RADIUS} ${DOCK_RADIUS} 0 1 1 ${-dockJoinX} ${dockJoinY}`,
  "Z",
].join(" ");

export function ShipView({ mapping, config }: SpecialViewProps<ShipConfig>) {
  const current = { ...defaultShipConfig, ...config };
  const fill = rgbaCss({ ...mapping.color, a: 255 });
  const charge = useShipPlayStore((state) => state.charges[mapping.id] ?? 0);
  const dock = useShipPlayStore((state) => state.docks[mapping.id]);
  const game = useShipPlayStore((state) => state.game);
  // In the editor there is no live runtime dock state, so preview the ship's
  // configured starting pose. Present mode supplies the authoritative state.
  // A minigame ship is detached even though its dock remains anchored and
  // visible in the runtime store.
  const inGame = game.activeShipId === mapping.id;
  const docked = !inGame && (dock?.docked ?? current.startsDocked);
  if (game.hiddenShipIds.includes(mapping.id)) return null;
  const gamePhase = inGame ? game.phase : "idle";
  const gameStyle = gamePhase === "dying"
    ? { opacity: 0, transform: "scale(1.8) rotate(24deg)", transition: "opacity 420ms, transform 420ms" }
    : gamePhase === "respawning"
      ? { animation: "ship-minigame-respawn 700ms ease-out both" }
      : undefined;

  return (
    <svg
      className="h-full w-full overflow-visible"
      viewBox="0 0 100 100"
      role="img"
      aria-label="Spaceship"
      style={gameStyle}
    >
      <g transform={`translate(50 50) rotate(${(current.angle * 180) / Math.PI})`}>
        {docked ? (
          <path d={dockedHullPath} fill={fill} />
        ) : (
          <polygon points={hullPoints} fill={fill} />
        )}
        {charge > 0.01 ? (
          <circle
            cx={SHIP_NOSE.x}
            cy={SHIP_NOSE.y}
            r={2 + charge * 16}
            fill="none"
            stroke="#fff"
            strokeWidth={1.4}
            opacity={0.4 + charge * 0.6}
          />
        ) : null}
      </g>
    </svg>
  );
}
