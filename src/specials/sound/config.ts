import type { Point } from "../../types";
import { centroid } from "../../geometry";

export const SOUND_PRESETS = [
  "click",
  "beep",
  "bell",
  "thud",
  "whoosh",
  "laser",
  "pop",
  "chime",
] as const;

export type SoundPresetId = (typeof SOUND_PRESETS)[number];

export type SoundGeometry = "polygon" | "circle";

export type SoundSource = "preset" | "custom";

export type SoundConfig = {
  geometry: SoundGeometry;
  source: SoundSource;
  preset: SoundPresetId;
  customAudio: string | null;
  customName: string | null;
  volume: number;
};

export const defaultSoundConfig: SoundConfig = {
  geometry: "polygon",
  source: "preset",
  preset: "click",
  customAudio: null,
  customName: null,
  volume: 0.85,
};

export const SOUND_PRESET_LABELS: Record<SoundPresetId, string> = {
  click: "Click",
  beep: "Beep",
  bell: "Bell",
  thud: "Thud",
  whoosh: "Whoosh",
  laser: "Laser",
  pop: "Pop",
  chime: "Chime",
};

export const MAX_SOUND_BYTES = 1_500_000;

export function polygonToCircleVertices(vertices: Point[]): Point[] {
  const center = centroid(vertices);
  const xs = vertices.map((vertex) => vertex.x);
  const ys = vertices.map((vertex) => vertex.y);
  const rx = Math.max((Math.max(...xs) - Math.min(...xs)) / 2, 32);
  const ry = Math.max((Math.max(...ys) - Math.min(...ys)) / 2, 32);
  return [
    center,
    { x: center.x + rx, y: center.y },
    { x: center.x, y: center.y - ry },
  ];
}

export function circleToPolygonVertices(vertices: Point[]): Point[] {
  const center = vertices[0];
  const rimU = vertices[1];
  const rimV = vertices[2];
  if (!center || !rimU || !rimV) {
    const { x, y } = center ?? { x: 0, y: 0 };
    return [
      { x, y: y - 70 },
      { x: x + 80, y: y + 50 },
      { x: x - 80, y: y + 50 },
    ];
  }
  const axisU = { x: rimU.x - center.x, y: rimU.y - center.y };
  const axisV = { x: rimV.x - center.x, y: rimV.y - center.y };
  const points: Point[] = [];
  const sides = 6;
  for (let index = 0; index < sides; index += 1) {
    const angle = (Math.PI * 2 * index) / sides - Math.PI / 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    points.push({
      x: center.x + cos * axisU.x + sin * axisV.x,
      y: center.y + cos * axisU.y + sin * axisV.y,
    });
  }
  return points;
}
