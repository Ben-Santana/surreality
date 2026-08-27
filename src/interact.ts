import {
  isCircleGeometry,
  mappingContainsBody,
  pointInPolygon,
  segmentsIntersect,
  translateVertices,
} from "./geometry";
import { getSpecial } from "./specials/registry";
import { emitSpecialEvent } from "./specials/events";
import type { Mapping, Point, SpecialMapping } from "./types";
import { isSpecialMapping } from "./types";

export function sameSurface(a: Mapping, b: Mapping): boolean {
  return (a.surfaceId ?? null) === (b.surfaceId ?? null);
}

/** Non-specials are always solid; specials default solid unless they opt out. */
export function isSolid(mapping: Mapping): boolean {
  if (!isSpecialMapping(mapping)) return true;
  return getSpecial(mapping.kind)?.solid !== false;
}

/** Same-surface solid mappings, excluding the actor. Order matches `mappings`. */
export function occupants(mappings: Mapping[], actor: Mapping): Mapping[] {
  return mappings.filter(
    (mapping) => mapping.id !== actor.id && sameSurface(mapping, actor) && isSolid(mapping),
  );
}

/** Topmost mapping whose body contains the point (last in the list wins). */
export function mappingBodyAt(mappings: Mapping[], point: Point): Mapping | null {
  for (let index = mappings.length - 1; index >= 0; index -= 1) {
    const mapping = mappings[index];
    if (mapping && mappingContainsBody(mapping, point)) return mapping;
  }
  return null;
}

export type MappingHit = {
  mapping: Mapping;
  point: Point;
};

/**
 * First mapping along `from → to`. Samples at `step` so rays cannot tunnel
 * through thin shapes. The point is the last clear sample before impact.
 */
export function mappingHitAlong(
  mappings: Mapping[],
  from: Point,
  to: Point,
  step = 4,
): MappingHit | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1e-6) {
    const mapping = mappingBodyAt(mappings, to);
    return mapping ? { mapping, point: to } : null;
  }
  const samples = Math.max(1, Math.ceil(distance / Math.max(1, step)));
  let previous = from;
  for (let index = 0; index <= samples; index += 1) {
    const t = index / samples;
    const point = { x: from.x + dx * t, y: from.y + dy * t };
    const mapping = mappingBodyAt(mappings, point);
    if (mapping) return { mapping, point: index === 0 ? point : previous };
    previous = point;
  }
  return null;
}

/** Click-equivalent: interactive specials with `onActivate`. */
export function activateMapping(mapping: Mapping): boolean {
  if (!isSpecialMapping(mapping) || !getSpecial(mapping.kind)?.interactive) return false;
  emitSpecialEvent({ type: "activate", targetId: mapping.id });
  return true;
}

export function interactiveSpecialAt(mappings: Mapping[], point: Point): SpecialMapping | null {
  const hit = mappingBodyAt(mappings, point);
  if (!hit || !isSpecialMapping(hit)) return null;
  if (!getSpecial(hit.kind)?.interactive) return null;
  return hit;
}

/** Whether a segment intersects the ellipse described by two (possibly skewed) axes. */
function segmentIntersectsEllipse(
  start: Point,
  end: Point,
  center: Point,
  axisU: Point,
  axisV: Point,
): boolean {
  const det = axisU.x * axisV.y - axisU.y * axisV.x;
  if (Math.abs(det) < 1e-6) return false;

  // Transform the segment into ellipse-local coordinates, where the ellipse
  // is a unit circle, then find the closest point on the segment to its center.
  const local = (point: Point): Point => {
    const x = point.x - center.x;
    const y = point.y - center.y;
    return {
      x: (x * axisV.y - y * axisV.x) / det,
      y: (axisU.x * y - axisU.y * x) / det,
    };
  };
  const a = local(start);
  const b = local(end);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared > 1e-12
    ? Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / lengthSquared))
    : 0;
  const closestX = a.x + dx * t;
  const closestY = a.y + dy * t;
  return closestX * closestX + closestY * closestY <= 1;
}

export function hullOverlapsMapping(hull: Point[], mapping: Mapping): boolean {
  if (hull.length === 0) return false;
  for (const point of hull) {
    if (mappingContainsBody(mapping, point)) return true;
  }
  if (isCircleGeometry(mapping)) {
    const center = mapping.vertices[0];
    const rimU = mapping.vertices[1];
    const rimV = mapping.vertices[2];
    if (!center || !rimU || !rimV) return false;
    if (pointInPolygon(center, hull)) return true;
    const axisU = { x: rimU.x - center.x, y: rimU.y - center.y };
    const axisV = { x: rimV.x - center.x, y: rimV.y - center.y };
    for (let index = 0; index < hull.length; index += 1) {
      const start = hull[index];
      const end = hull[(index + 1) % hull.length];
      if (start && end && segmentIntersectsEllipse(start, end, center, axisU, axisV)) {
        return true;
      }
    }
    return false;
  }
  for (const point of mapping.vertices) {
    if (pointInPolygon(point, hull)) return true;
  }
  for (let hullIndex = 0; hullIndex < hull.length; hullIndex += 1) {
    const hullStart = hull[hullIndex];
    const hullEnd = hull[(hullIndex + 1) % hull.length];
    if (!hullStart || !hullEnd) continue;
    for (let edgeIndex = 0; edgeIndex < mapping.vertices.length; edgeIndex += 1) {
      const edgeStart = mapping.vertices[edgeIndex];
      const edgeEnd = mapping.vertices[(edgeIndex + 1) % mapping.vertices.length];
      if (!edgeStart || !edgeEnd) continue;
      if (segmentsIntersect(hullStart, hullEnd, edgeStart, edgeEnd)) return true;
    }
  }
  return false;
}

export function hullHitsOccupants(hull: Point[], obstacles: Mapping[]): boolean {
  return obstacles.some((mapping) => hullOverlapsMapping(hull, mapping));
}

/** Axis-slide against occupants. If already overlapping, do not block (escape). */
export function clampHullAgainstOccupants(
  hull: Point[],
  dx: number,
  dy: number,
  obstacles: Mapping[],
): { dx: number; dy: number } {
  if (obstacles.length === 0 || hullHitsOccupants(hull, obstacles)) return { dx, dy };
  if (!hullHitsOccupants(translateVertices(hull, { x: dx, y: dy }), obstacles)) {
    return { dx, dy };
  }
  const xClear = !hullHitsOccupants(translateVertices(hull, { x: dx, y: 0 }), obstacles);
  const yClear = !hullHitsOccupants(translateVertices(hull, { x: 0, y: dy }), obstacles);
  if (xClear && !yClear) return { dx, dy: 0 };
  if (yClear && !xClear) return { dx: 0, dy };
  if (xClear && yClear) {
    return Math.abs(dx) >= Math.abs(dy) ? { dx, dy: 0 } : { dx: 0, dy };
  }
  return { dx: 0, dy: 0 };
}
