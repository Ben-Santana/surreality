import { useShipPlayStore, type ScreenExhaust } from "./playStore";
import { LASER_WIDTH } from "./config";

export function LiveShipBullets() {
  const bullets = useShipPlayStore((state) => state.bullets);
  return <ShipBullets bullets={bullets} />;
}

export function LiveShipExhaust() {
  const exhaust = useShipPlayStore((state) => state.exhaust);
  return <ShipExhaust exhaust={exhaust} />;
}

export function ShipExhaust({ exhaust }: { exhaust: ScreenExhaust[] }) {
  if (exhaust.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {exhaust.map((puff) => {
        if (puff.opacity <= 0 || puff.r <= 0) return null;
        const size = puff.r * 2;
        return (
          <div
            key={puff.id}
            className="absolute rounded-full bg-white"
            style={{
              left: puff.x - puff.r,
              top: puff.y - puff.r,
              width: size,
              height: size,
              opacity: puff.opacity,
            }}
          />
        );
      })}
    </div>
  );
}

export function ShipBullets({
  bullets,
}: {
  bullets: {
    id: number;
    x: number;
    y: number;
    tx: number;
    ty: number;
    color: { r: number; g: number; b: number; a: number };
    opacity?: number;
  }[];
}) {
  if (bullets.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {bullets.map((bullet) => {
        const life = bullet.opacity ?? 1;
        if (life <= 0) return null;
        const dx = bullet.tx - bullet.x;
        const dy = bullet.ty - bullet.y;
        const length = Math.max(2, Math.hypot(dx, dy));
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        return (
          <div
            key={bullet.id}
            className="absolute bg-white"
            style={{
              left: bullet.x,
              top: bullet.y,
              width: length,
              height: LASER_WIDTH,
              marginTop: -LASER_WIDTH / 2,
              transform: `rotate(${angle}deg) scaleY(${life})`,
              transformOrigin: "0 50%",
            }}
          />
        );
      })}
    </div>
  );
}
