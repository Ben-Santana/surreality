import { getSpecial } from "./specials/registry";
import type {
  CircleMapping,
  Mapping,
  Point,
  PolygonMapping,
  SpecialMapping,
  Surface,
  TextMapping,
} from "./types";
import { DEFAULT_TEXT_FONT } from "./textFonts";

const counters: Record<string, number> = {
  polygon: 0,
  circle: 0,
  text: 0,
  surface: 0,
};

function counterKey(mapping: Mapping) {
  return mapping.type === "special" ? `special:${mapping.kind}` : mapping.type;
}

export function resetCounters(mappings: Mapping[], surfaces: Surface[] = []) {
  for (const key of Object.keys(counters)) delete counters[key];
  counters.polygon = 0;
  counters.circle = 0;
  counters.text = 0;
  counters.surface = 0;
  for (const mapping of mappings) {
    const key = counterKey(mapping);
    counters[key] = (counters[key] ?? 0) + 1;
  }
  counters.surface = surfaces.length;
}

function nextName(key: string, label: string) {
  counters[key] = (counters[key] ?? 0) + 1;
  return `${label} ${counters[key]}`;
}

function id() {
  return crypto.randomUUID();
}

export function createPolygon(position: Point): PolygonMapping {
  const { x, y } = position;
  return {
    id: id(),
    type: "polygon",
    name: nextName("polygon", "Polygon"),
    color: { r: 70, g: 160, b: 255, a: 255 },
    vertices: [
      { x, y: y - 70 },
      { x: x + 80, y: y + 50 },
      { x: x - 80, y: y + 50 },
    ],
  };
}

export function createCircle(position: Point): CircleMapping {
  const { x, y } = position;
  return {
    id: id(),
    type: "circle",
    name: nextName("circle", "Circle"),
    color: { r: 255, g: 110, b: 90, a: 255 },
    vertices: [
      { x, y },
      { x: x + 80, y },
      { x, y: y - 80 },
    ],
  };
}

export function createText(position: Point): TextMapping {
  const { x, y } = position;
  const width = 220;
  const height = 72;
  return {
    id: id(),
    type: "text",
    name: nextName("text", "Text"),
    text: "Projection",
    fontFamily: DEFAULT_TEXT_FONT,
    color: { r: 36, g: 36, b: 42, a: 240 },
    vertices: [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ],
  };
}

export function createSpecial(kind: string, position: Point): SpecialMapping | null {
  const definition = getSpecial(kind);
  if (!definition) return null;
  const { x, y } = position;
  const { width, height } = definition.contentSize;
  const geometry = definition.geometry ?? "quad";
  const vertices =
    geometry === "circle"
      ? [
          { x, y },
          { x: x + Math.max(40, width / 2), y },
          { x, y: y - Math.max(40, height / 2) },
        ]
      : geometry === "polygon"
        ? [
            { x, y: y - height / 2 },
            { x: x + width / 2, y: y + height * 0.35 },
            { x: x - width / 2, y: y + height * 0.35 },
          ]
        : [
            { x: x - width / 2, y: y - height / 2 },
            { x: x + width / 2, y: y - height / 2 },
            { x: x + width / 2, y: y + height / 2 },
            { x: x - width / 2, y: y + height / 2 },
          ];
  return {
    id: id(),
    type: "special",
    kind: definition.kind,
    version: definition.version ?? 1,
    name: nextName(`special:${definition.kind}`, definition.label),
    color: { ...definition.defaultColor },
    config: { ...definition.defaultConfig } as Record<string, unknown>,
    vertices,
  };
}

export function createSurface(position: Point): Surface {
  const width = 480;
  const height = 300;
  const x = position.x - width / 2;
  const y = position.y - height / 2;
  return {
    id: id(),
    name: nextName("surface", "Surface"),
    vertices: [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ],
    wall: { width, height },
  };
}

export function duplicateSurface(surface: Surface): Surface {
  const copy = structuredClone(surface);
  copy.id = id();
  copy.name = `${surface.name} copy`;
  copy.vertices = copy.vertices.map((vertex) => ({ x: vertex.x + 24, y: vertex.y + 24 }));
  counters.surface = (counters.surface ?? 0) + 1;
  return copy;
}

export function duplicateMapping(mapping: Mapping): Mapping {
  const copy = structuredClone(mapping);
  copy.id = id();
  copy.name = `${mapping.name} copy`;
  copy.vertices = copy.vertices.map((vertex) => ({ x: vertex.x + 24, y: vertex.y + 24 }));
  const key = counterKey(mapping);
  counters[key] = (counters[key] ?? 0) + 1;
  return copy;
}
