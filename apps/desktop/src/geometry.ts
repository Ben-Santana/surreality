import type { Mapping, Point, Quad, Rgba, Surface } from "./types";
import { customMappingGeometry } from "./customMappings/config";

export const HANDLE_RADIUS = 8;

export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function snapPoint(point: Point, step: number): Point {
  if (step <= 0) return point;
  return {
    x: Math.round(point.x / step) * step,
    y: Math.round(point.y / step) * step,
  };
}

export function sub(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(a: Point, s: number): Point {
  return { x: a.x * s, y: a.y * s };
}

export function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function centroid(vertices: Point[]): Point {
  const sum = vertices.reduce((acc, vertex) => add(acc, vertex), { x: 0, y: 0 });
  return scale(sum, 1 / vertices.length);
}

export function polygonArea(vertices: Point[]): number {
  let area = 0;
  for (let index = 0; index < vertices.length; index += 1) {
    const current = vertices[index];
    const next = vertices[(index + 1) % vertices.length];
    if (!current || !next) continue;
    area += current.x * next.y - next.x * current.y;
  }
  return area / 2;
}

export function isConvexPolygon(vertices: Point[]): boolean {
  let sign = 0;
  for (let index = 0; index < vertices.length; index += 1) {
    const a = vertices[index];
    const b = vertices[(index + 1) % vertices.length];
    const c = vertices[(index + 2) % vertices.length];
    if (!a || !b || !c) return false;
    const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if (Math.abs(cross) < 1e-8) continue;
    const nextSign = cross > 0 ? 1 : -1;
    if (sign === 0) sign = nextSign;
    else if (nextSign !== sign) return false;
  }
  return sign !== 0;
}

export function isValidWarpQuad(vertices: Point[]): boolean {
  if (vertices.length !== 4) return false;
  for (let index = 0; index < vertices.length; index += 1) {
    const current = vertices[index];
    const next = vertices[(index + 1) % vertices.length];
    if (!current || !next || dist(current, next) < 2) return false;
  }
  return isConvexPolygon(vertices) && Math.abs(polygonArea(vertices)) >= 64;
}

export function rgbaCss(color: Rgba): string {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
}

export function hexFromRgba(color: Rgba): string {
  const toHex = (value: number) => value.toString(16).padStart(2, "0");
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

export function rgbaFromHex(hex: string, alpha = 255): Rgba | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match?.[1]) return null;
  const value = match[1];
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
    a: alpha,
  };
}

export function contrastColor(color: Rgba): Rgba {
  const luma = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
  return luma > 140 ? { r: 30, g: 30, b: 30, a: 255 } : { r: 240, g: 240, b: 240, a: 255 };
}

export function pointInPolygon(point: Point, vertices: Point[]): boolean {
  let inside = false;
  let previous = vertices[vertices.length - 1];
  if (!previous) return false;
  for (const vertex of vertices) {
    const crosses = vertex.y > point.y !== previous.y > point.y;
    if (crosses) {
      const atX =
        ((previous.x - vertex.x) * (point.y - vertex.y)) / (previous.y - vertex.y) +
        vertex.x;
      if (point.x < atX) inside = !inside;
    }
    previous = vertex;
  }
  return inside;
}

export function closestPointOnSegment(start: Point, end: Point, point: Point): Point {
  const along = sub(end, start);
  const lengthSquared = along.x * along.x + along.y * along.y;
  if (lengthSquared === 0) return { ...start };
  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * along.x + (point.y - start.y) * along.y) / lengthSquared),
  );
  return add(start, scale(along, t));
}

export function insertVertexNear(vertices: Point[], point: Point): Point[] {
  let bestIndex = 0;
  let bestPoint = vertices[0] ?? point;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < vertices.length; index += 1) {
    const start = vertices[index];
    const end = vertices[(index + 1) % vertices.length];
    if (!start || !end) continue;
    const closest = closestPointOnSegment(start, end, point);
    const distance = dist(point, closest);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
      bestPoint = closest;
    }
  }

  const next = vertices.slice();
  next.splice(bestIndex + 1, 0, bestPoint);
  return next;
}

export function pointInEllipse(
  point: Point,
  center: Point,
  axisU: Point,
  axisV: Point,
): boolean {
  const offset = sub(point, center);
  const det = axisU.x * axisV.y - axisU.y * axisV.x;
  if (Math.abs(det) < 1e-6) return false;
  const s = (offset.x * axisV.y - offset.y * axisV.x) / det;
  const t = (axisU.x * offset.y - axisU.y * offset.x) / det;
  return s * s + t * t <= 1;
}

export function hitHandle(point: Point, target: Point, radius = HANDLE_RADIUS): boolean {
  return dist(point, target) <= radius;
}

function offsetAnchor(from: Point, center: Point, fallback: Point): Point {
  let outward = sub(from, center);
  if (Math.hypot(outward.x, outward.y) < 1) outward = fallback;
  const length = dist(outward, { x: 0, y: 0 }) || 1;
  return add(from, scale(outward, (HANDLE_RADIUS * 2.2) / length));
}

export function isCircleGeometry(mapping: Mapping): boolean {
  if (mapping.type === "circle") return true;
  if (mapping.type !== "custom") return false;
  return customMappingGeometry(mapping) === "circle";
}

export function isPolygonGeometry(mapping: Mapping): boolean {
  if (mapping.type === "polygon") return true;
  if (mapping.type !== "custom") return false;
  return customMappingGeometry(mapping) === "polygon";
}

export function mappingAnchor(mapping: Mapping): Point {
  if (isCircleGeometry(mapping)) {
    return mapping.vertices[0] ?? { x: 0, y: 0 };
  }
  if (mapping.type === "text") {
    const topLeft = mapping.vertices[0] ?? { x: 0, y: 0 };
    return offsetAnchor(topLeft, centroid(mapping.vertices), { x: -1, y: -1 });
  }
  return centroid(mapping.vertices);
}

export function mappingContainsBody(mapping: Mapping, point: Point): boolean {
  if (isCircleGeometry(mapping)) {
    const center = mapping.vertices[0];
    const rimU = mapping.vertices[1];
    const rimV = mapping.vertices[2];
    if (!center || !rimU || !rimV) return false;
    return pointInEllipse(point, center, sub(rimU, center), sub(rimV, center));
  }
  return pointInPolygon(point, mapping.vertices);
}

export function containsMapping(mapping: Mapping, point: Point): boolean {
  if (visibleHandles(mapping).some((handle) => hitHandle(point, handle.point))) {
    return true;
  }
  if (hitHandle(point, mappingAnchor(mapping))) return true;
  return mappingContainsBody(mapping, point);
}

export function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const along = sub(b, a);
  const other = sub(d, c);
  const den = along.x * other.y - along.y * other.x;
  if (Math.abs(den) < 1e-10) return false;
  const offset = sub(c, a);
  const t = (offset.x * other.y - offset.y * other.x) / den;
  const u = (offset.x * along.y - offset.y * along.x) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

export type HandleKind = "vertex" | "anchor";

export type HandleHit = {
  kind: HandleKind;
  index?: number;
  point: Point;
};

export function visibleHandles(mapping: Mapping): HandleHit[] {
  const handles: HandleHit[] = mapping.vertices
    .map((point, index) => ({ kind: "vertex" as const, index, point }))
    .filter((handle) => !isCircleGeometry(mapping) || handle.index !== 0);
  handles.push({ kind: "anchor", point: mappingAnchor(mapping) });
  return handles;
}

export function hitTestHandle(mapping: Mapping, point: Point): HandleHit | null {
  const handles = visibleHandles(mapping);
  for (let index = handles.length - 1; index >= 0; index -= 1) {
    const handle = handles[index];
    if (handle && hitHandle(point, handle.point)) return handle;
  }
  return null;
}

export function translateVertices(vertices: Point[], delta: Point): Point[] {
  return vertices.map((vertex) => add(vertex, delta));
}

export function asQuad(vertices: Point[]): Quad | null {
  const [tl, tr, br, bl] = vertices;
  if (!tl || !tr || !br || !bl || vertices.length !== 4) return null;
  return [tl, tr, br, bl];
}

export function boundingQuad(vertices: Point[]): Quad {
  const xs = vertices.map((vertex) => vertex.x);
  const ys = vertices.map((vertex) => vertex.y);
  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 80 },
      { x: 0, y: 80 },
    ];
  }
  if (maxX - minX < 8) {
    const mid = (minX + maxX) / 2;
    minX = mid - 40;
    maxX = mid + 40;
  }
  if (maxY - minY < 8) {
    const mid = (minY + maxY) / 2;
    minY = mid - 40;
    maxY = mid + 40;
  }
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
}

export function isValidWall(wall: { width: number; height: number } | undefined): boolean {
  if (!wall) return false;
  return (
    Number.isFinite(wall.width) &&
    Number.isFinite(wall.height) &&
    wall.width >= 8 &&
    wall.height >= 8
  );
}

export function surfaceAnchor(surface: Surface): Point {
  return centroid(surface.vertices);
}

export function containsSurface(surface: Surface, point: Point): boolean {
  if (visibleSurfaceHandles(surface).some((handle) => hitHandle(point, handle.point))) {
    return true;
  }
  return pointInPolygon(point, surface.vertices);
}

export function visibleSurfaceHandles(surface: Surface): HandleHit[] {
  const handles: HandleHit[] = surface.vertices.map((point, index) => ({
    kind: "vertex" as const,
    index,
    point,
  }));
  handles.push({ kind: "anchor", point: surfaceAnchor(surface) });
  return handles;
}

export function hitTestSurfaceHandle(surface: Surface, point: Point): HandleHit | null {
  const handles = visibleSurfaceHandles(surface);
  for (let index = handles.length - 1; index >= 0; index -= 1) {
    const handle = handles[index];
    if (handle && hitHandle(point, handle.point)) return handle;
  }
  return null;
}

export function moveCircleVertex(vertices: Point[], index: number, position: Point): Point[] {
  if (index === 0) {
    const center = vertices[0];
    if (!center) return vertices;
    return translateVertices(vertices, sub(position, center));
  }
  return vertices.map((vertex, vertexIndex) => (vertexIndex === index ? position : vertex));
}
