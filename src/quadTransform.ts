import type { Point } from "./types";

function adj(m: number[]) {
  return [
    m[4]! * m[8]! - m[5]! * m[7]!,
    m[2]! * m[7]! - m[1]! * m[8]!,
    m[1]! * m[5]! - m[2]! * m[4]!,
    m[5]! * m[6]! - m[3]! * m[8]!,
    m[0]! * m[8]! - m[2]! * m[6]!,
    m[2]! * m[3]! - m[0]! * m[5]!,
    m[3]! * m[7]! - m[4]! * m[6]!,
    m[1]! * m[6]! - m[0]! * m[7]!,
    m[0]! * m[4]! - m[1]! * m[3]!,
  ];
}

function multiply(a: number[], b: number[]) {
  const out = Array<number>(9);
  for (let i = 0; i < 3; i += 1) {
    for (let j = 0; j < 3; j += 1) {
      let sum = 0;
      for (let k = 0; k < 3; k += 1) {
        sum += a[3 * i + k]! * b[3 * k + j]!;
      }
      out[3 * i + j] = sum;
    }
  }
  return out;
}

function multiplyVector(m: number[], v: number[]) {
  return [
    m[0]! * v[0]! + m[1]! * v[1]! + m[2]! * v[2]!,
    m[3]! * v[0]! + m[4]! * v[1]! + m[5]! * v[2]!,
    m[6]! * v[0]! + m[7]! * v[1]! + m[8]! * v[2]!,
  ];
}

function basisToPoints(p1: Point, p2: Point, p3: Point, p4: Point) {
  const m = [p1.x, p2.x, p3.x, p1.y, p2.y, p3.y, 1, 1, 1];
  const v = multiplyVector(adj(m), [p4.x, p4.y, 1]);
  return multiply(m, [v[0]!, 0, 0, 0, v[1]!, 0, 0, 0, v[2]!]);
}

function generalProjection(from: [Point, Point, Point, Point], to: [Point, Point, Point, Point]) {
  const s = basisToPoints(...from);
  const d = basisToPoints(...to);
  return multiply(d, adj(s));
}

export function projectPoint(
  from: [Point, Point, Point, Point],
  to: [Point, Point, Point, Point],
  point: Point,
): Point {
  const matrix = generalProjection(from, to);
  const w = matrix[6]! * point.x + matrix[7]! * point.y + matrix[8]!;
  if (Math.abs(w) < 1e-12) return { ...point };
  return {
    x: (matrix[0]! * point.x + matrix[1]! * point.y + matrix[2]!) / w,
    y: (matrix[3]! * point.x + matrix[4]! * point.y + matrix[5]!) / w,
  };
}

export function projectVertices(
  from: [Point, Point, Point, Point],
  to: [Point, Point, Point, Point],
  vertices: Point[],
): Point[] {
  return vertices.map((point) => projectPoint(from, to, point));
}

export function quadToMatrix3d(
  width: number,
  height: number,
  corners: [Point, Point, Point, Point],
) {
  const [tl, tr, br, bl] = corners;
  if (!tl || !tr || !br || !bl) return "none";

  const matrix = generalProjection(
    [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ],
    [tl, tr, br, bl],
  );

  for (let i = 0; i < 9; i += 1) matrix[i]! /= matrix[8] ?? 1;

  return `matrix3d(${[
    matrix[0],
    matrix[3],
    0,
    matrix[6],
    matrix[1],
    matrix[4],
    0,
    matrix[7],
    0,
    0,
    1,
    0,
    matrix[2],
    matrix[5],
    0,
    matrix[8],
  ].join(",")})`;
}
