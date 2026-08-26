import { useEffect, useRef, useState } from "react";
import { centroid } from "../../geometry";
import type { Point } from "../../types";
import type { SpecialViewProps } from "../types";
import type { SoundConfig } from "./config";
import { onSoundPulse } from "./player";

const RING_MS = 380;
const SCALE_END = 1.12;
const STROKE_START = 3.5;
const STROKE_END = 0.35;

type Ring = { id: number; born: number };

function easeOutQuart(t: number) {
  const inv = 1 - t;
  return 1 - inv * inv * inv * inv;
}

function expandFrom(origin: Point, vertices: Point[], amount: number) {
  return vertices.map((vertex) => ({
    x: origin.x + (vertex.x - origin.x) * amount,
    y: origin.y + (vertex.y - origin.y) * amount,
  }));
}

function ellipsePoints(vertices: Point[], steps = 72): Point[] {
  const center = vertices[0];
  const rimU = vertices[1];
  const rimV = vertices[2];
  if (!center || !rimU || !rimV) return [];
  const axisU = { x: rimU.x - center.x, y: rimU.y - center.y };
  const axisV = { x: rimV.x - center.x, y: rimV.y - center.y };
  const points: Point[] = [];
  for (let index = 0; index < steps; index += 1) {
    const angle = (Math.PI * 2 * index) / steps;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    points.push({
      x: center.x + cos * axisU.x + sin * axisV.x,
      y: center.y + cos * axisU.y + sin * axisV.y,
    });
  }
  return points;
}

function outlineVertices(geometry: SoundConfig["geometry"], vertices: Point[]) {
  return geometry === "circle" ? ellipsePoints(vertices) : vertices;
}

export function SoundView({ mapping, config }: SpecialViewProps<SoundConfig>) {
  const geometry = config.geometry ?? "polygon";
  const vertices = mapping.vertices;
  const ringsRef = useRef<Ring[]>([]);
  const nextId = useRef(1);
  const [now, setNow] = useState(0);
  const [active, setActive] = useState(false);

  useEffect(
    () =>
      onSoundPulse((id) => {
        if (id !== mapping.id) return;
        ringsRef.current = [...ringsRef.current, { id: nextId.current, born: performance.now() }];
        nextId.current += 1;
        setActive(true);
      }),
    [mapping.id],
  );

  useEffect(() => {
    if (!active) return undefined;
    let frame = 0;
    const tick = (time: number) => {
      ringsRef.current = ringsRef.current.filter((ring) => time - ring.born < RING_MS);
      setNow(time);
      if (ringsRef.current.length === 0) {
        setActive(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active]);

  const rings = ringsRef.current;
  if (rings.length === 0) return null;

  const source = outlineVertices(geometry, vertices);
  const origin = geometry === "circle" ? (vertices[0] ?? { x: 0, y: 0 }) : centroid(vertices);

  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
      {rings.map((ring) => {
        const t = easeOutQuart(Math.min(1, Math.max(0, (now - ring.born) / RING_MS)));
        const amount = 1 + (SCALE_END - 1) * t;
        const stroke = STROKE_START + (STROKE_END - STROKE_START) * t;
        const points = expandFrom(origin, source, amount)
          .map((vertex) => `${vertex.x},${vertex.y}`)
          .join(" ");
        return (
          <polygon
            key={ring.id}
            points={points}
            fill="none"
            stroke="#fff"
            strokeWidth={stroke}
            strokeLinejoin={geometry === "circle" ? "round" : "miter"}
            strokeMiterlimit={8}
          />
        );
      })}
    </svg>
  );
}
