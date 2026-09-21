import {
  asQuad,
  dist,
  isCircleGeometry,
  isValidWall,
  isValidWarpQuad,
  mappingAnchor,
  pointInPolygon,
} from "./geometry";
import { projectPoint, projectVertices } from "./quadTransform";
import type { Mapping, Point, Quad, Surface, WallSize } from "./types";

/**
 * A surface is a flat rectangular wall seen in perspective: `wall` is the real
 * rectangle, `vertices` is how that rectangle appears on screen. Mappings on a
 * surface store their geometry in wall coordinates (unskewed, origin at the
 * wall's top-left corner) and are projected to the quad only for display, so
 * the same shape re-skews as it moves across the wall.
 *
 * The wall's metric comes from the quad's edge lengths so one unit is the same
 * in x and y. A circle stays a circle (plus perspective) on a wide rectangle
 * instead of stretching to the quad's aspect ratio.
 */
export function wallSizeFromQuad(vertices: Point[]): WallSize | null {
  const quad = asQuad(vertices);
  if (!quad || !isValidWarpQuad(vertices)) return null;
  const [tl, tr, br, bl] = quad;
  const width = (dist(tl, tr) + dist(bl, br)) / 2;
  const height = (dist(tl, bl) + dist(tr, br)) / 2;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 8 || height < 8) return null;
  return { width, height };
}

export function wallMetric(surface: Surface): WallSize {
  return wallSizeFromQuad(surface.vertices) ?? surface.wall;
}

export function wallQuad(surface: Surface): Quad {
  const { width, height } = wallMetric(surface);
  return [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
}

function projection(surface: Surface): { wall: Quad; screen: Quad } | null {
  const screen = asQuad(surface.vertices);
  if (!screen || !isValidWarpQuad(surface.vertices)) return null;
  const size = wallMetric(surface);
  if (!isValidWall(size)) return null;
  return { wall: wallQuad(surface), screen };
}

function finite(vertices: Point[]) {
  return vertices.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

export function wallToScreen(surface: Surface, vertices: Point[]): Point[] {
  const pair = projection(surface);
  if (!pair) return vertices;
  const projected = projectVertices(pair.wall, pair.screen, vertices);
  return finite(projected) ? projected : vertices;
}

export function screenToWall(surface: Surface, vertices: Point[]): Point[] {
  const pair = projection(surface);
  if (!pair) return vertices;
  const projected = projectVertices(pair.screen, pair.wall, vertices);
  return finite(projected) ? projected : vertices;
}

export function wallToScreenPoint(surface: Surface, point: Point): Point {
  const pair = projection(surface);
  if (!pair) return point;
  const projected = projectPoint(pair.wall, pair.screen, point);
  return finite([projected]) ? projected : point;
}

export function screenToWallPoint(surface: Surface, point: Point): Point {
  const pair = projection(surface);
  if (!pair) return point;
  const projected = projectPoint(pair.screen, pair.wall, point);
  return finite([projected]) ? projected : point;
}

export function surfaceById(surfaces: Surface[], id: string | null | undefined): Surface | null {
  if (!id) return null;
  return surfaces.find((surface) => surface.id === id) ?? null;
}

export function anchorOf(mapping: Mapping, vertices: Point[] = mapping.vertices): Point {
  if (vertices === mapping.vertices) return mappingAnchor(mapping);
  return mappingAnchor({ ...mapping, vertices } as Mapping);
}

export function displayVertices(mapping: Mapping, surfaces: Surface[]): Point[] {
  const surface = surfaceById(surfaces, mapping.surfaceId);
  if (!surface) return mapping.vertices;
  return wallToScreen(surface, mapping.vertices);
}

export function displayMapping(mapping: Mapping, surfaces: Surface[]): Mapping {
  const surface = surfaceById(surfaces, mapping.surfaceId);
  const vertices = surface ? wallToScreen(surface, mapping.vertices) : mapping.vertices;
  if (vertices === mapping.vertices) return mapping;

  if (isCircleGeometry(mapping)) {
    const center = mapping.vertices[0];
    const rimU = mapping.vertices[1];
    const rimV = mapping.vertices[2];
    if (center && rimU && rimV && surface) {
      const axisU = { x: rimU.x - center.x, y: rimU.y - center.y };
      const axisV = { x: rimV.x - center.x, y: rimV.y - center.y };
      const perimeter = Array.from({ length: 64 }, (_, index) => {
        const angle = (index / 64) * Math.PI * 2;
        return {
          x: center.x + axisU.x * Math.cos(angle) + axisV.x * Math.sin(angle),
          y: center.y + axisU.y * Math.cos(angle) + axisV.y * Math.sin(angle),
        };
      });
      return {
        ...mapping,
        vertices,
        projectedOutline: wallToScreen(surface, perimeter),
      } as Mapping;
    }
  }

  return { ...mapping, vertices, projectedOutline: undefined } as Mapping;
}

export function displayMappings(mappings: Mapping[], surfaces: Surface[]): Mapping[] {
  if (surfaces.length === 0 || !mappings.some((mapping) => mapping.surfaceId)) return mappings;
  return mappings.map((mapping) => displayMapping(mapping, surfaces));
}

export function topSurfaceAt(surfaces: Surface[], point: Point): Surface | null {
  for (let index = surfaces.length - 1; index >= 0; index -= 1) {
    const surface = surfaces[index];
    if (surface && pointInPolygon(point, surface.vertices)) return surface;
  }
  return null;
}
