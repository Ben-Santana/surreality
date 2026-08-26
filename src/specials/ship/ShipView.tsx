import { rgbaCss } from "../../geometry";
import type { SpecialViewProps } from "../types";
import { defaultShipConfig, SHIP_HULL, SHIP_NOSE, type ShipConfig } from "./config";
import { useShipPlayStore } from "./playStore";

const hullPoints = SHIP_HULL.map((point) => `${point.x},${point.y}`).join(" ");

export function ShipView({ mapping, config }: SpecialViewProps<ShipConfig>) {
  const current = { ...defaultShipConfig, ...config };
  const fill = rgbaCss({ ...mapping.color, a: 255 });
  const charge = useShipPlayStore((state) => state.charges[mapping.id] ?? 0);

  return (
    <svg
      className="h-full w-full overflow-visible"
      viewBox="0 0 100 100"
      role="img"
      aria-label="Spaceship"
    >
      <g transform={`translate(50 50) rotate(${(current.angle * 180) / Math.PI})`}>
        <polygon points={hullPoints} fill={fill} />
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
