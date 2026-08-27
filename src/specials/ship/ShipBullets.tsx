import { rgbaCss } from "../../geometry";
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

export function LiveShipDocks() {
  const docks = useShipPlayStore((state) => state.docks);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Object.entries(docks).map(([id, dock]) => {
        const size = dock.r * 2;
        const pulse = Math.sin(dock.transition * Math.PI);
        return (
          <div
            key={id}
            className="absolute rounded-full border-2"
            style={{
              left: dock.x - dock.r,
              top: dock.y - dock.r,
              width: size,
              height: size,
              borderColor: rgbaCss({ ...dock.color, a: dock.docked ? 90 : 190 }),
              background: dock.docked ? "transparent" : rgbaCss({ ...dock.color, a: 28 }),
              boxShadow: `0 0 ${8 + pulse * 18}px ${rgbaCss({ ...dock.color, a: 150 })}`,
              transform: `scale(${1 + pulse * 0.16})`,
            }}
          />
        );
      })}
    </div>
  );
}

export function LiveShipMinigame() {
  const game = useShipPlayStore((state) => state.game);
  if (game.phase === "idle") return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {game.stars.map((star) => (
        (() => {
          const height = Math.max(star.r * 2, star.length);
          return (
            <div
              key={`star-${star.id}`}
              className="absolute rounded-full bg-white"
              style={{
                left: star.x - star.r,
                top: star.y - height + star.r,
                width: star.r * 2,
                height,
                opacity: star.opacity,
              }}
            />
          );
        })()
      ))}
      {game.enemies.map((enemy) => (
        <div
          key={`enemy-${enemy.id}`}
          className="absolute rounded-full bg-red-600"
          style={{
            left: enemy.x - enemy.r,
            top: enemy.y - enemy.r,
            width: enemy.r * 2,
            height: enemy.r * 2,
            opacity: enemy.opacity,
          }}
        />
      ))}
    </div>
  );
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
