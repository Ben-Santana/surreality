import { useEffect } from "react";
import { asQuad, centroid, isCircleGeometry, lerp, pointInPolygon, translateVertices } from "../../geometry";
import {
  clampHullAgainstOccupants,
  hullHitsOccupants,
  mappingHitAlong,
  occupants,
} from "../../interact";
import { useRoomStore } from "../../store";
import type { Mapping, Point, SpecialMapping, Surface } from "../../types";
import { isSpecialMapping } from "../../types";
import { surfaceById, wallMetric, wallToScreenPoint } from "../../wall";
import {
  CHARGE_IN,
  CHARGE_OUT,
  DOCK_CAPTURE_RADIUS,
  DOCK_RADIUS,
  DOCK_TRANSITION_MS,
  EXHAUST_LIFE_MS,
  EXHAUST_LIFE_SPREAD_MS,
  EXHAUST_RADIUS,
  EXHAUST_RADIUS_SPREAD,
  EXHAUST_RATE,
  EXHAUST_SHRINK,
  EXHAUST_SPEED,
  EXHAUST_SPEED_SPREAD,
  EXHAUST_SPREAD,
  FIRE_COOLDOWN_MS,
  LASER_MS,
  LASER_SAMPLE,
  LINEAR_INERTIA,
  RECOIL_PX,
  SHIP_CONTENT_SIZE,
  SHIP_HULL,
  SHIP_NOSE,
  SHIP_THRUSTER,
  SHIP_VIEWBOX,
  THRUST_SPEED,
  TURN_INERTIA,
  TURN_SPEED,
  defaultShipConfig,
  type ShipConfig,
} from "./config";
import { idleShipGame, useShipPlayStore, type ScreenBullet, type ScreenEnemy, type ScreenExhaust, type ScreenStar } from "./playStore";
import { resumeThrustAudio, setThrustRumble, stopThrustRumble } from "./thrustSound";
import { asConfig } from "../types";
import { emitSpecialEvent } from "../events";
import { SOUND_PRESETS, type SoundPresetId } from "../sound/config";
import { playSoundPreset } from "../sound/player";

type Bounds = { x: number; y: number; width: number; height: number };

type LocalLaser = {
  id: number;
  mappingId: string;
  from: Point;
  to: Point;
  born: number;
};

type LocalExhaust = {
  id: number;
  mappingId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  life: number;
  startR: number;
};

type InputState = {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  fire: boolean;
  dock: boolean;
};

const emptyInput: InputState = {
  left: false,
  right: false,
  up: false,
  down: false,
  fire: false,
  dock: false,
};

type Motion = {
  vx: number;
  vy: number;
  omega: number;
};

type DockMotion = {
  center: Point;
  phase: "docked" | "releasing" | "free" | "docking";
  started: number;
  from: Point;
  captureArmed: boolean;
};

type GameEnemy = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  r: number;
  burst: Point;
};
type ShipGame = {
  shipId: string;
  surfaceId: string;
  phase: "centering" | "hyperspeed" | "playing" | "dying" | "respawning";
  started: number;
  stars: Array<Point & { id: number; r: number }>;
  enemies: GameEnemy[];
  originals: Map<string, Mapping>;
  nextSpawn: number;
  playStarted: number;
  killCount: number;
  hyperspeedAcc: number;
};

const HYPERSPEED_MS = 4400;
const HYPERSPEED_PEAK_AT = 0.58;
const ENEMY_POP_MS = 280;
const ENEMY_LINGER_MS = 820;

function smoothstep(value: number) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

/** A full travel curve: build speed, briefly reach warp, then coast to rest. */
function hyperspeedVelocity(progress: number) {
  if (progress < HYPERSPEED_PEAK_AT) {
    return smoothstep(progress / HYPERSPEED_PEAK_AT);
  }
  return 1 - smoothstep((progress - HYPERSPEED_PEAK_AT) / (1 - HYPERSPEED_PEAK_AT));
}

/** Stars remain dots at low speed and only stretch once the motion is convincing. */
function hyperspeedStreak(velocity: number) {
  return smoothstep((velocity - 0.22) / 0.78);
}

const LINEAR_STOP = 10;
const TURN_STOP = 0.08;

const MAX_EXHAUST = 220;

let input: InputState = { ...emptyInput };
let previousDockInput = false;
let lasers: LocalLaser[] = [];
let exhaust: LocalExhaust[] = [];
let nextLaserId = 1;
let nextExhaustId = 1;
const lastShotAt = new Map<string, number>();
const motions = new Map<string, Motion>();
const charges = new Map<string, number>();
const exhaustAcc = new Map<string, number>();
const docks = new Map<string, DockMotion>();
let game: ShipGame | null = null;
let nextEnemyId = 1;

function scaleMapping(mapping: Mapping, factor: number): Mapping {
  const center = mapping.type === "circle" ? mapping.vertices[0] : centroid(mapping.vertices);
  if (!center) return mapping;
  return {
    ...mapping,
    color: { r: 230, g: 18, b: 26, a: 255 },
    vertices: mapping.vertices.map((point) => ({
      x: center.x + (point.x - center.x) * factor,
      y: center.y + (point.y - center.y) * factor,
    })),
  } as Mapping;
}

function startGame(key: string, now: number): boolean {
  if (game) return false;
  const state = useRoomStore.getState();
  const ships = state.mappings.filter(isShip);
  const ship = ships.find((item) => {
    const config = shipConfig(item);
    return config.minigameEnabled && (config.minigameKey || "g").toLowerCase() === key.toLowerCase();
  });
  if (!ship?.surfaceId) return false;
  const surface = surfaceById(state.surfaces, ship.surfaceId);
  if (!surface) return false;
  const basics = state.mappings.filter(
    (item) => item.surfaceId === ship.surfaceId && (item.type === "polygon" || item.type === "circle"),
  );
  const originals = new Map<string, Mapping>([[ship.id, structuredClone(ship)]]);
  for (const mapping of basics) originals.set(mapping.id, structuredClone(mapping));
  const { width, height } = wallMetric(surface);
  const stars: ShipGame["stars"] = [];
  for (let index = 0; index < 110; index += 1) {
    stars.push({ x: Math.random() * width, y: -Math.random() * height, id: index, r: 0.6 + Math.random() * 1.25 });
  }
  game = {
    shipId: ship.id,
    surfaceId: ship.surfaceId,
    phase: "centering",
    started: now,
    stars,
    enemies: [],
    originals,
    nextSpawn: now + 1500,
    playStarted: 0,
    killCount: 0,
    hyperspeedAcc: 0,
  };
  // Keep the dock's world-space anchor alive during the minigame. The ship is
  // detached from it below, but the dock itself must remain where it was set.
  if (shipConfig(ship).startsDocked && !docks.has(ship.id)) {
    const center = centroid(ship.vertices);
    docks.set(ship.id, { center, phase: "docked", started: now, from: center, captureArmed: false });
  }
  motions.set(ship.id, { vx: 0, vy: 0, omega: 0 });
  return true;
}

function restoreGameMappings(includeShip: boolean) {
  if (!game) return;
  const state = useRoomStore.getState();
  useRoomStore.setState({
    mappings: state.mappings.map((mapping) => {
      if (!includeShip && mapping.id === game?.shipId) return mapping;
      return game?.originals.get(mapping.id) ?? mapping;
    }),
  });
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

function isShip(mapping: Mapping): mapping is SpecialMapping {
  return isSpecialMapping(mapping) && mapping.packageId === "room.mapping.ship";
}

function heading(angle: number): Point {
  return { x: Math.sin(angle), y: -Math.cos(angle) };
}

function shortestAngle(from: number, to: number) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

function shipConfig(mapping: SpecialMapping): ShipConfig {
  const current = asConfig(mapping, defaultShipConfig);
  return {
    angle: Number.isFinite(current.angle) ? current.angle : 0,
    startsDocked: current.startsDocked === true,
    minigameEnabled: current.minigameEnabled === true,
    minigameKey: typeof current.minigameKey === "string" ? current.minigameKey : "g",
    minigameHitSound: SOUND_PRESETS.includes(current.minigameHitSound as SoundPresetId)
      ? current.minigameHitSound as SoundPresetId
      : "pop",
    minigameHitVolume: Number.isFinite(current.minigameHitVolume)
      ? Math.max(0, Math.min(1, current.minigameHitVolume))
      : 0.85,
  };
}

function playBounds(mapping: SpecialMapping, surfaces: Surface[]): Bounds {
  const surface = surfaceById(surfaces, mapping.surfaceId);
  if (surface) {
    const { width, height } = wallMetric(surface);
    return { x: 0, y: 0, width, height };
  }
  return { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
}

function rayExit(from: Point, dir: Point, bounds: Bounds): Point {
  let t = Number.POSITIVE_INFINITY;
  if (dir.x > 1e-8) t = Math.min(t, (bounds.x + bounds.width - from.x) / dir.x);
  else if (dir.x < -1e-8) t = Math.min(t, (bounds.x - from.x) / dir.x);
  if (dir.y > 1e-8) t = Math.min(t, (bounds.y + bounds.height - from.y) / dir.y);
  else if (dir.y < -1e-8) t = Math.min(t, (bounds.y - from.y) / dir.y);
  if (!Number.isFinite(t) || t < 0) t = 0;
  return { x: from.x + dir.x * t, y: from.y + dir.y * t };
}

export function shipLocalToWorld(vertices: Point[], angle: number, local: Point): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const rx = local.x * cos - local.y * sin;
  const ry = local.x * sin + local.y * cos;
  const u = (SHIP_VIEWBOX / 2 + rx) / SHIP_VIEWBOX;
  const v = (SHIP_VIEWBOX / 2 + ry) / SHIP_VIEWBOX;
  const quad = asQuad(vertices);
  if (!quad) {
    const origin = centroid(vertices);
    return {
      x: origin.x + (u - 0.5) * SHIP_CONTENT_SIZE.width,
      y: origin.y + (v - 0.5) * SHIP_CONTENT_SIZE.height,
    };
  }
  const [tl, tr, br, bl] = quad;
  return lerp(lerp(tl, tr, u), lerp(bl, br, u), v);
}

function shipHull(vertices: Point[], angle: number) {
  return SHIP_HULL.map((point) => shipLocalToWorld(vertices, angle, point));
}

function localToWorldDelta(vertices: Point[], angle: number, local: Point, delta: Point): Point {
  const from = shipLocalToWorld(vertices, angle, local);
  const to = shipLocalToWorld(vertices, angle, { x: local.x + delta.x, y: local.y + delta.y });
  return { x: to.x - from.x, y: to.y - from.y };
}

function spawnExhaust(
  mappingId: string,
  vertices: Point[],
  angle: number,
  local: Point,
  awayY: number,
  now: number,
  travelScale = 1,
) {
  const pos = {
    x: local.x + (Math.random() - 0.5) * 10,
    y: local.y + awayY * Math.random() * 4,
  };
  const startRLocal = EXHAUST_RADIUS + Math.random() * EXHAUST_RADIUS_SPREAD;
  const speed = (EXHAUST_SPEED + Math.random() * EXHAUST_SPEED_SPREAD) * travelScale;
  const world = shipLocalToWorld(vertices, angle, pos);
  const vel = localToWorldDelta(vertices, angle, pos, {
    x: (Math.random() - 0.5) * EXHAUST_SPREAD,
    y: awayY * speed,
  });
  const radius = localToWorldDelta(vertices, angle, pos, { x: startRLocal, y: 0 });
  exhaust.push({
    id: nextExhaustId,
    mappingId,
    x: world.x,
    y: world.y,
    vx: vel.x,
    vy: vel.y,
    born: now,
    life: (EXHAUST_LIFE_MS + Math.random() * EXHAUST_LIFE_SPREAD_MS) * Math.min(1.45, 1 + (travelScale - 1) * 0.12),
    startR: Math.hypot(radius.x, radius.y),
  });
  nextExhaustId += 1;
}

function clampTranslation(points: Point[], dx: number, dy: number, bounds: Bounds) {
  if (points.length === 0) return { dx: 0, dy: 0 };
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  let nextDx = dx;
  let nextDy = dy;
  const left = bounds.x;
  const right = bounds.x + bounds.width;
  const top = bounds.y;
  const bottom = bounds.y + bounds.height;
  if (minX + nextDx < left) nextDx = left - minX;
  if (maxX + nextDx > right) nextDx = right - maxX;
  if (minY + nextDy < top) nextDy = top - minY;
  if (maxY + nextDy > bottom) nextDy = bottom - maxY;
  if (maxX - minX > bounds.width) nextDx = left + bounds.width / 2 - (minX + maxX) / 2;
  if (maxY - minY > bounds.height) nextDy = top + bounds.height / 2 - (minY + maxY) / 2;
  return { dx: nextDx, dy: nextDy };
}

function insideBounds(point: Point, bounds: Bounds, pad = 0) {
  return (
    point.x >= bounds.x - pad &&
    point.y >= bounds.y - pad &&
    point.x <= bounds.x + bounds.width + pad &&
    point.y <= bounds.y + bounds.height + pad
  );
}

function segmentCircleHit(from: Point, to: Point, center: Point, radius: number): number | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const fx = from.x - center.x;
  const fy = from.y - center.y;
  const a = dx * dx + dy * dy;
  if (a < 1e-8) return null;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const root = Math.sqrt(discriminant);
  const candidates = [(-b - root) / (2 * a), (-b + root) / (2 * a)].filter((t) => t >= 0 && t <= 1);
  return candidates.length > 0 ? Math.min(...candidates) : null;
}

function enemyTouchesHull(enemy: GameEnemy, hull: Point[]): boolean {
  if (pointInPolygon(enemy, hull)) return true;
  for (let index = 0; index < hull.length; index += 1) {
    const a = hull[index];
    const b = hull[(index + 1) % hull.length];
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared > 0
      ? Math.max(0, Math.min(1, ((enemy.x - a.x) * dx + (enemy.y - a.y) * dy) / lengthSquared))
      : 0;
    if (Math.hypot(enemy.x - (a.x + dx * t), enemy.y - (a.y + dy * t)) <= enemy.r) return true;
  }
  return false;
}

function enemyHullAt(point: Point, radius: number): Point[] {
  const hull: Point[] = [];
  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2;
    hull.push({ x: point.x + Math.cos(angle) * radius, y: point.y + Math.sin(angle) * radius });
  }
  return hull;
}

function enemyPositionClear(point: Point, radius: number, obstacles: Mapping[], bounds: Bounds) {
  if (!insideBounds(point, bounds, radius)) return false;
  return !hullHitsOccupants(enemyHullAt(point, radius), obstacles);
}

function moveEnemyConstrained(enemy: GameEnemy, dx: number, dy: number, obstacles: Mapping[], bounds: Bounds) {
  const distance = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(distance / Math.max(2, enemy.r * 0.45)));
  for (let index = 0; index < steps; index += 1) {
    const stepX = dx / steps;
    const stepY = dy / steps;
    const direct = { x: enemy.x + stepX, y: enemy.y + stepY };
    if (enemyPositionClear(direct, enemy.r, obstacles, bounds)) {
      enemy.x = direct.x;
      enemy.y = direct.y;
      continue;
    }
    const alongX = { x: enemy.x + stepX, y: enemy.y };
    const alongY = { x: enemy.x, y: enemy.y + stepY };
    const xClear = enemyPositionClear(alongX, enemy.r, obstacles, bounds);
    const yClear = enemyPositionClear(alongY, enemy.r, obstacles, bounds);
    if (xClear && (!yClear || Math.abs(stepX) >= Math.abs(stepY))) enemy.x = alongX.x;
    else if (yClear) enemy.y = alongY.y;
    else {
      enemy.vx *= 0.35;
      enemy.vy *= 0.35;
      break;
    }
  }
}

function navigateEnemy(enemy: GameEnemy, target: Point, obstacles: Mapping[], bounds: Bounds, dt: number) {
  const direct = Math.atan2(target.y - enemy.y, target.x - enemy.x);
  const current = Math.hypot(enemy.vx, enemy.vy) > 2 ? Math.atan2(enemy.vy, enemy.vx) : direct;
  const speed = 42;
  const lookAhead = Math.max(22, speed * 0.65);
  let bestAngle = current;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let index = 0; index < 24; index += 1) {
    const angle = direct + (index === 0 ? 0 : (index % 2 === 1 ? 1 : -1) * Math.ceil(index / 2) * Math.PI / 12);
    const probe = { x: enemy.x + Math.cos(angle) * lookAhead, y: enemy.y + Math.sin(angle) * lookAhead };
    if (!enemyPositionClear(probe, enemy.r, obstacles, bounds)) continue;
    const distanceScore = Math.hypot(target.x - probe.x, target.y - probe.y);
    const turnScore = Math.abs(shortestAngle(current, angle)) * 9;
    const score = distanceScore + turnScore;
    if (score < bestScore) {
      bestScore = score;
      bestAngle = angle;
    }
  }
  enemy.vx = approach(enemy.vx, Math.cos(bestAngle) * speed, 3.8, dt);
  enemy.vy = approach(enemy.vy, Math.sin(bestAngle) * speed, 3.8, dt);
  moveEnemyConstrained(enemy, enemy.vx * dt, enemy.vy * dt, obstacles, bounds);
}

function spawnEnemyAtShape(mapping: Mapping, obstacles: Mapping[], bounds: Bounds, radius: number) {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    let edge: Point | null = null;
    let outward: Point | null = null;
    if (isCircleGeometry(mapping)) {
      const center = mapping.vertices[0];
      const rimU = mapping.vertices[1];
      const rimV = mapping.vertices[2];
      if (!center || !rimU || !rimV) return null;
      const angle = Math.random() * Math.PI * 2;
      const axisU = { x: rimU.x - center.x, y: rimU.y - center.y };
      const axisV = { x: rimV.x - center.x, y: rimV.y - center.y };
      edge = {
        x: center.x + axisU.x * Math.cos(angle) + axisV.x * Math.sin(angle),
        y: center.y + axisU.y * Math.cos(angle) + axisV.y * Math.sin(angle),
      };
      const radial = { x: edge.x - center.x, y: edge.y - center.y };
      const length = Math.max(1e-6, Math.hypot(radial.x, radial.y));
      outward = { x: radial.x / length, y: radial.y / length };
    } else {
      const edgeIndex = Math.floor(Math.random() * mapping.vertices.length);
      const start = mapping.vertices[edgeIndex];
      const end = mapping.vertices[(edgeIndex + 1) % mapping.vertices.length];
      if (!start || !end) continue;
      const along = 0.12 + Math.random() * 0.76;
      edge = lerp(start, end, along);
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.max(1e-6, Math.hypot(dx, dy));
      const normalA = { x: -dy / length, y: dx / length };
      const probeA = { x: edge.x + normalA.x * 3, y: edge.y + normalA.y * 3 };
      outward = pointInPolygon(probeA, mapping.vertices)
        ? { x: -normalA.x, y: -normalA.y }
        : normalA;
    }
    if (!edge || !outward) continue;
    // One pixel of breathing room keeps the collision hull outside while the
    // enemy still appears visually attached to the shape's edge.
    for (let gap = 1; gap <= 6; gap += 1) {
      const point = {
        x: edge.x + outward.x * (radius + gap),
        y: edge.y + outward.y * (radius + gap),
      };
      if (enemyPositionClear(point, radius, obstacles, bounds)) return { point, outward };
    }
  }
  return null;
}

function chargeOf(id: string): number {
  return charges.get(id) ?? 0;
}

function setCharge(id: string, value: number) {
  if (value < 0.002) charges.delete(id);
  else charges.set(id, value);
}

function motionOf(id: string): Motion {
  const existing = motions.get(id);
  if (existing) return existing;
  const next = { vx: 0, vy: 0, omega: 0 };
  motions.set(id, next);
  return next;
}

function approach(current: number, target: number, rate: number, dt: number) {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

function applyKey(event: KeyboardEvent, down: boolean) {
  if (event.code === "KeyE" || event.key.toLowerCase() === "e") {
    input.dock = down;
    return true;
  }
  if (event.code === "Space" || event.key === " " || event.key === "Spacebar") {
    input.fire = down;
    return true;
  }
  switch (event.key) {
    case "ArrowLeft":
      input.left = down;
      return true;
    case "ArrowRight":
      input.right = down;
      return true;
    case "ArrowUp":
      input.up = down;
      return true;
    case "ArrowDown":
      input.down = down;
      return true;
    default:
      return false;
  }
}

function toScreen(mapping: SpecialMapping, surfaces: Surface[], point: Point) {
  const surface = surfaceById(surfaces, mapping.surfaceId);
  return surface ? wallToScreenPoint(surface, point) : point;
}

function publishPlay(now: number, mappings: Mapping[], surfaces: Surface[]) {
  const byId = new Map(mappings.map((mapping) => [mapping.id, mapping]));
  const screen: ScreenBullet[] = [];
  for (const laser of lasers) {
    const mapping = byId.get(laser.mappingId);
    if (!mapping || !isShip(mapping)) continue;
    const from = toScreen(mapping, surfaces, laser.from);
    const to = toScreen(mapping, surfaces, laser.to);
    const age = now - laser.born;
    screen.push({
      id: laser.id,
      x: from.x,
      y: from.y,
      tx: to.x,
      ty: to.y,
      color: mapping.color,
      opacity: Math.max(0, 1 - age / LASER_MS),
    });
  }
  const screenExhaust: ScreenExhaust[] = [];
  for (const puff of exhaust) {
    const mapping = byId.get(puff.mappingId);
    if (!mapping || !isShip(mapping)) continue;
    const t = Math.min(1, (now - puff.born) / puff.life);
    const point = toScreen(mapping, surfaces, { x: puff.x, y: puff.y });
    const edge = toScreen(mapping, surfaces, { x: puff.x + puff.startR, y: puff.y });
    screenExhaust.push({
      id: puff.id,
      x: point.x,
      y: point.y,
      r: Math.max(0.4, Math.hypot(edge.x - point.x, edge.y - point.y) * (1 - t * EXHAUST_SHRINK)),
      opacity: 1 - t,
    });
  }
  const nextCharges: Record<string, number> = {};
  for (const [id, value] of charges) nextCharges[id] = value;
  const screenDocks: Record<string, import("./playStore").ScreenDock> = {};
  for (const [id, dock] of docks) {
    const mapping = byId.get(id);
    if (!mapping || !isShip(mapping)) continue;
    const center = toScreen(mapping, surfaces, dock.center);
    const edge = toScreen(mapping, surfaces, { x: dock.center.x + DOCK_RADIUS, y: dock.center.y });
    const elapsed = Math.max(0, now - dock.started);
    screenDocks[id] = {
      x: center.x,
      y: center.y,
      r: Math.hypot(edge.x - center.x, edge.y - center.y),
      docked: dock.phase === "docked",
      transition: dock.phase === "releasing" || dock.phase === "docking"
        ? Math.min(1, elapsed / DOCK_TRANSITION_MS)
        : 0,
      color: mapping.color,
    };
  }
  let screenGame = idleShipGame;
  if (game) {
    const active = byId.get(game.shipId);
    const surface = surfaceById(surfaces, game.surfaceId);
    if (active && isShip(active) && surface) {
      const hyperspeedProgress = game.phase === "hyperspeed"
        ? Math.min(1, Math.max(0, (now - game.started) / HYPERSPEED_MS))
        : 1;
      const starVelocity = game.phase === "hyperspeed" ? hyperspeedVelocity(hyperspeedProgress) : 0;
      const streak = hyperspeedStreak(starVelocity);
      const trailLength = streak * 52;
      const blockers = mappings.filter(
        (mapping) => mapping.surfaceId === game?.surfaceId && mapping.id !== game?.shipId && !isShip(mapping),
      );
      const stars: ScreenStar[] = game.phase === "hyperspeed" || game.phase === "playing" || game.phase === "dying" || game.phase === "respawning"
        ? game.stars
            .filter((star) => {
              const tail = { x: star.x, y: star.y - trailLength };
              return !mappingHitAlong(blockers, tail, star, 3);
            })
            .map((star) => {
              const point = wallToScreenPoint(surface, star);
              const tail = wallToScreenPoint(surface, { x: star.x, y: star.y - trailLength });
              return {
                id: star.id,
                x: point.x,
                y: point.y,
                r: star.r,
                length: Math.max(star.r * 2, Math.hypot(point.x - tail.x, point.y - tail.y)),
                opacity: 0.55 + (star.id % 5) * 0.1,
              };
            })
        : [];
      const enemies: ScreenEnemy[] = game.enemies.map((enemy) => {
        const point = wallToScreenPoint(surface, enemy);
        const edge = wallToScreenPoint(surface, { x: enemy.x + enemy.r, y: enemy.y });
        return {
          id: enemy.id,
          x: point.x,
          y: point.y,
          r: Math.max(3, Math.hypot(edge.x - point.x, edge.y - point.y)),
          opacity: 1,
        };
      });
      screenGame = {
        activeShipId: game.shipId,
        hiddenShipIds: mappings.filter(isShip).filter((item) => item.id !== game?.shipId).map((item) => item.id),
        phase: game.phase,
        stars,
        enemies,
        killCount: game.killCount,
      };
    }
  }
  useShipPlayStore.getState().setPlay({
    bullets: screen,
    charges: nextCharges,
    exhaust: screenExhaust,
    docks: screenDocks,
    game: screenGame,
  });
}

function clearPlay() {
  lasers = [];
  exhaust = [];
  lastShotAt.clear();
  motions.clear();
  charges.clear();
  exhaustAcc.clear();
  docks.clear();
  if (game) restoreGameMappings(true);
  game = null;
  previousDockInput = false;
  setThrustRumble(false);
  useShipPlayStore.getState().setPlay({ bullets: [], charges: {}, exhaust: [], docks: {}, game: idleShipGame });
}

function restoreShipsToDocks() {
  if (docks.size === 0) return;
  const state = useRoomStore.getState();
  let changed = false;
  const mappings = state.mappings.map((mapping) => {
    const dock = docks.get(mapping.id);
    if (!dock || !isShip(mapping)) return mapping;
    const center = centroid(mapping.vertices);
    const dx = dock.center.x - center.x;
    const dy = dock.center.y - center.y;
    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return mapping;
    changed = true;
    return {
      ...mapping,
      vertices: translateVertices(mapping.vertices, { x: dx, y: dy }),
    };
  });
  if (changed) useRoomStore.setState({ mappings });
}

export function useShipRuntime() {
  const presenting = useRoomStore((state) => state.spaceEntered && !state.editMode);

  useEffect(() => {
    if (!presenting) {
      input = { ...emptyInput };
      clearPlay();
      stopThrustRumble();
      return;
    }

    let frame = 0;
    let last = performance.now();
    let running = true;

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (!event.repeat && startGame(event.key, performance.now())) {
        event.preventDefault();
        return;
      }
      if (!applyKey(event, true)) return;
      event.preventDefault();
      if (input.up || input.down) resumeThrustAudio();
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (applyKey(event, false)) event.preventDefault();
    };

    const onBlur = () => {
      input = { ...emptyInput };
      setThrustRumble(false);
    };

    const tick = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      let state = useRoomStore.getState();
      if (game?.phase === "dying" && now - game.started >= 480) {
        restoreGameMappings(true);
        game.phase = "respawning";
        game.started = now;
        state = useRoomStore.getState();
      } else if (game?.phase === "respawning" && now - game.started >= 760) {
        game = null;
      }
      const ships = state.mappings.filter(isShip);
      if (ships.length === 0) {
        if (lasers.length > 0 || exhaust.length > 0) clearPlay();
        frame = requestAnimationFrame(tick);
        return;
      }

      let mappings = state.mappings;
      let moved = false;
      const dockPressed = input.dock && !previousDockInput;
      previousDockInput = input.dock;
      const liveShips = new Set(ships.map((ship) => ship.id));
      for (const id of [...motions.keys()]) {
        if (!liveShips.has(id)) motions.delete(id);
      }
      for (const id of [...charges.keys()]) {
        if (!liveShips.has(id)) charges.delete(id);
      }
      for (const id of [...exhaustAcc.keys()]) {
        if (!liveShips.has(id)) exhaustAcc.delete(id);
      }
      for (const id of [...docks.keys()]) {
        if (!liveShips.has(id)) docks.delete(id);
      }

      for (const ship of ships) {
        if (game && ship.id !== game.shipId) continue;
        const config = shipConfig(ship);
        const inGame = game?.shipId === ship.id;
        const bounds = playBounds(ship, state.surfaces);
        const motion = motionOf(ship.id);
        let dock = docks.get(ship.id);
        if (game?.shipId === ship.id) {
          // Ignore docking physics for the active game ship without deleting
          // the persistent dock that publishPlay renders at its fixed anchor.
          dock = undefined;
        } else if (config.startsDocked && !dock) {
          const center = centroid(ship.vertices);
          dock = { center, phase: "docked", started: now, from: center, captureArmed: false };
          docks.set(ship.id, dock);
        } else if (!config.startsDocked && dock) {
          docks.delete(ship.id);
          dock = undefined;
        }
        if (dockPressed && dock?.phase === "docked") {
          dock.phase = "releasing";
          dock.started = now;
          dock.captureArmed = false;
          motion.vx = 0;
          motion.vy = 0;
        }
        if (dock?.phase === "releasing" && now - dock.started >= DOCK_TRANSITION_MS) {
          dock.phase = "free";
          dock.started = now;
        }
        let targetOmega = 0;
        if (!inGame || game?.phase === "playing") {
          if (input.left) targetOmega -= TURN_SPEED;
          if (input.right) targetOmega += TURN_SPEED;
        }
        motion.omega = approach(motion.omega, targetOmega, TURN_INERTIA, dt);
        if (Math.abs(motion.omega) < TURN_STOP && targetOmega === 0) motion.omega = 0;
        let angle = config.angle + motion.omega * dt;
        if (inGame && (game?.phase === "centering" || game?.phase === "hyperspeed")) {
          const original = game.originals.get(ship.id);
          const originalAngle = original && isShip(original) ? shipConfig(original).angle : config.angle;
          const turnT = game.phase === "centering" ? Math.min(1, (now - game.started) / 900) : 1;
          const easedTurn = 1 - Math.pow(1 - turnT, 3);
          angle = originalAngle + shortestAngle(originalAngle, 0) * easedTurn;
          motion.omega = 0;
        }
        const nose = heading(angle);

        let targetVx = 0;
        let targetVy = 0;
        const canFly = inGame ? game?.phase === "playing" : !dock || dock.phase === "free";
        if (input.up && canFly) {
          targetVx += nose.x * THRUST_SPEED;
          targetVy += nose.y * THRUST_SPEED;
        }
        if (input.down && canFly) {
          targetVx -= nose.x * THRUST_SPEED;
          targetVy -= nose.y * THRUST_SPEED;
        }
        motion.vx = approach(motion.vx, targetVx, LINEAR_INERTIA, dt);
        motion.vy = approach(motion.vy, targetVy, LINEAR_INERTIA, dt);
        if (
          targetVx === 0 &&
          targetVy === 0 &&
          Math.hypot(motion.vx, motion.vy) < LINEAR_STOP
        ) {
          motion.vx = 0;
          motion.vy = 0;
        }

        const firing = input.fire && (!inGame || game?.phase === "playing") && now - (lastShotAt.get(ship.id) ?? 0) >= FIRE_COOLDOWN_MS;
        if (!canFly) {
          motion.vx = 0;
          motion.vy = 0;
        }
        const recoil = canFly && firing ? RECOIL_PX : 0;
        let dx = motion.vx * dt - nose.x * recoil;
        let dy = motion.vy * dt - nose.y * recoil;
        const shipCenter = centroid(ship.vertices);
        if (inGame && game?.phase === "centering") {
          const surface = surfaceById(state.surfaces, game.surfaceId);
          const original = game.originals.get(ship.id);
          if (surface && original) {
            const size = wallMetric(surface);
            const target = { x: size.width / 2, y: size.height / 2 };
            const start = centroid(original.vertices);
            const t = Math.min(1, (now - game.started) / 1200);
            const eased = 1 - Math.pow(1 - t, 3);
            const next = lerp(start, target, eased);
            dx = next.x - shipCenter.x;
            dy = next.y - shipCenter.y;
            if (t >= 1) {
              game.phase = "hyperspeed";
              game.started = now;
              for (const star of game.stars) {
                star.x = Math.random() * size.width;
                star.y = Math.random() * size.height;
              }
            }
          }
        } else if (inGame && game?.phase === "hyperspeed") {
          const surface = surfaceById(state.surfaces, game.surfaceId);
          if (surface) {
            const size = wallMetric(surface);
            const target = { x: size.width / 2, y: size.height / 2 };
            dx = target.x - shipCenter.x;
            dy = target.y - shipCenter.y;
            const progress = Math.min(1, (now - game.started) / HYPERSPEED_MS);
            const velocity = hyperspeedVelocity(progress);
            const starSpeed = velocity * 880;
            for (const star of game.stars) {
              star.y += starSpeed * dt * (0.7 + (star.id % 7) * 0.07);
              if (star.y > size.height + 50) {
                star.x = Math.random() * size.width;
                star.y = -20 - Math.random() * size.height * 0.2;
              }
            }
            if (progress >= 1) {
              game.phase = "playing";
              game.started = now;
              game.playStarted = now;
              game.nextSpawn = now + 650;
              mappings = mappings.map((mapping) => {
                const original = game?.originals.get(mapping.id);
                return original && (original.type === "polygon" || original.type === "circle")
                  ? scaleMapping(original, 1.12)
                  : mapping;
              });
              moved = true;
            }
          }
        }
        const distanceFromDock = dock
          ? Math.hypot(shipCenter.x - dock.center.x, shipCenter.y - dock.center.y)
          : Number.POSITIVE_INFINITY;
        // The furthest hull point is 36 local units from its center. Re-arm
        // capture only once the complete ship has cleared the dock circle.
        if (dock?.phase === "free" && distanceFromDock > DOCK_RADIUS + 36) {
          dock.captureArmed = true;
        }
        if (
          dock?.phase === "free" &&
          dock.captureArmed &&
          distanceFromDock <= DOCK_CAPTURE_RADIUS
        ) {
          dock.phase = "docking";
          dock.started = now;
          dock.from = shipCenter;
          dock.captureArmed = false;
          motion.vx = 0;
          motion.vy = 0;
        }
        if (dock?.phase === "docking") {
          const t = Math.min(1, (now - dock.started) / DOCK_TRANSITION_MS);
          const eased = 1 - Math.pow(1 - t, 3);
          const target = lerp(dock.from, dock.center, eased);
          dx = target.x - shipCenter.x;
          dy = target.y - shipCenter.y;
          if (t >= 1) {
            dock.phase = "docked";
            dock.started = now;
          }
        }
        const obstacles = inGame
          ? (game?.phase === "centering" || game?.phase === "hyperspeed" ? [] : occupants(mappings, ship).filter((item) => !isShip(item)))
          : occupants(mappings, ship);
        let hull = shipHull(ship.vertices, angle);
        const previousHull = shipHull(ship.vertices, config.angle);
        // Rotation changes the hull without translating its mapping vertices.
        // Reject a colliding pose so the ship cannot turn a wing through an
        // obstacle while its center remains stationary. Translation still
        // allows an already-overlapping ship to move out of an obstacle.
        if (angle !== config.angle && hullHitsOccupants(hull, obstacles)) {
          angle = config.angle;
          motion.omega = 0;
          hull = previousHull;
        }
        const againstWalls = clampTranslation(hull, dx, dy, bounds);
        const againstMaps = clampHullAgainstOccupants(
          hull,
          againstWalls.dx,
          againstWalls.dy,
          obstacles,
        );
        if (Math.abs(againstMaps.dx - motion.vx * dt) > 0.02) motion.vx = 0;
        if (Math.abs(againstMaps.dy - motion.vy * dt) > 0.02) motion.vy = 0;
        const vertices =
          againstMaps.dx !== 0 || againstMaps.dy !== 0
            ? translateVertices(ship.vertices, { x: againstMaps.dx, y: againstMaps.dy })
            : ship.vertices;
        if (vertices !== ship.vertices || angle !== config.angle) {
          mappings = mappings.map((mapping) =>
            mapping.id === ship.id
              ? {
                  ...ship,
                  vertices,
                  config: { ...ship.config, angle },
                }
              : mapping,
          );
          moved = true;
        }

        if (inGame && game?.phase === "hyperspeed") {
          const progress = Math.min(1, (now - game.started) / HYPERSPEED_MS);
          const velocity = hyperspeedVelocity(progress);
          let acc = game.hyperspeedAcc + dt * EXHAUST_RATE * (1.2 + velocity * 3.2);
          while (acc >= 1) {
            acc -= 1;
            spawnExhaust(ship.id, vertices, angle, SHIP_THRUSTER, 1, now, 1.35 + velocity * 2.65);
          }
          game.hyperspeedAcc = acc;
        }

        if (inGame && game?.phase === "playing") {
          const enemyObstacles = mappings.filter(
            (item) => item.id !== ship.id && item.surfaceId === ship.surfaceId && (item.type === "polygon" || item.type === "circle"),
          );
          if (now >= game.nextSpawn && game.enemies.length < 18) {
            const sources = enemyObstacles;
            if (sources.length > 0) {
              const source = sources[Math.floor(Math.random() * sources.length)];
              if (source) {
                const spawn = spawnEnemyAtShape(source, enemyObstacles, bounds, 9);
                if (spawn) {
                  game.enemies.push({
                    id: nextEnemyId++,
                    x: spawn.point.x,
                    y: spawn.point.y,
                    vx: spawn.outward.x * 150,
                    vy: spawn.outward.y * 150,
                    born: now,
                    r: 9,
                    burst: spawn.outward,
                  });
                }
              }
            }
            const elapsedSeconds = Math.max(0, (now - game.playStarted) / 1000);
            const spawnBase = Math.max(230, 1050 - elapsedSeconds * 32);
            game.nextSpawn = now + spawnBase * (0.82 + Math.random() * 0.36);
          }
          const center = centroid(vertices);
          const movedHull = translateVertices(hull, { x: againstMaps.dx, y: againstMaps.dy });
          let dead = false;
          for (const enemy of game.enemies) {
            const age = now - enemy.born;
            if (age < ENEMY_POP_MS) {
              const popEase = 1 - age / ENEMY_POP_MS;
              enemy.vx = enemy.burst.x * 150 * popEase;
              enemy.vy = enemy.burst.y * 150 * popEase;
              moveEnemyConstrained(enemy, enemy.vx * dt, enemy.vy * dt, enemyObstacles, bounds);
            } else if (age < ENEMY_LINGER_MS) {
              enemy.vx = approach(enemy.vx, 0, 9, dt);
              enemy.vy = approach(enemy.vy, 0, 9, dt);
              moveEnemyConstrained(enemy, enemy.vx * dt, enemy.vy * dt, enemyObstacles, bounds);
            } else {
              navigateEnemy(enemy, center, enemyObstacles, bounds, dt);
            }
            if (enemyTouchesHull(enemy, movedHull)) dead = true;
          }
          if (dead) {
            game.phase = "dying";
            game.started = now;
            game.enemies = [];
            motion.vx = 0;
            motion.vy = 0;
            motion.omega = 0;
            mappings = mappings.map((mapping) =>
              mapping.id === ship.id ? mapping : game?.originals.get(mapping.id) ?? mapping,
            );
            moved = true;
          }
        }

        setCharge(
          ship.id,
          approach(chargeOf(ship.id), input.fire ? 1 : 0, input.fire ? CHARGE_IN : CHARGE_OUT, dt),
        );

        if (firing) {
          if (inGame) playSoundPreset("thud", 0.85);
          const muzzle = shipLocalToWorld(vertices, angle, SHIP_NOSE);
          const origin = insideBounds(muzzle, bounds) ? muzzle : centroid(hull);
          const edge = rayExit(origin, nose, bounds);
          const laserObstacles = game?.shipId === ship.id
            ? occupants(mappings, ship).filter((item) => !isShip(item))
            : occupants(mappings, ship);
          const hit = mappingHitAlong(laserObstacles, origin, edge, LASER_SAMPLE);
          const mapDistance = hit ? Math.hypot(hit.point.x - origin.x, hit.point.y - origin.y) : Number.POSITIVE_INFINITY;
          let enemyHit: GameEnemy | null = null;
          let enemyT = Number.POSITIVE_INFINITY;
          if (game?.shipId === ship.id && game.phase === "playing") {
            for (const enemy of game.enemies) {
              const t = segmentCircleHit(origin, edge, enemy, enemy.r + 2);
              if (t !== null && t < enemyT) {
                enemyT = t;
                enemyHit = enemy;
              }
            }
          }
          const enemyPoint = enemyHit ? lerp(origin, edge, enemyT) : null;
          const hitsEnemyFirst = Boolean(enemyHit && enemyPoint && Math.hypot(enemyPoint.x - origin.x, enemyPoint.y - origin.y) < mapDistance);
          if (hitsEnemyFirst && enemyHit && game) {
            game.enemies = game.enemies.filter((enemy) => enemy.id !== enemyHit?.id);
            game.killCount += 1;
            playSoundPreset(config.minigameHitSound, config.minigameHitVolume);
          } else if (hit) {
            emitSpecialEvent({ type: "hit", sourceId: ship.id, targetId: hit.mapping.id, point: hit.point });
          }
          lasers.push({
            id: nextLaserId,
            mappingId: ship.id,
            from: origin,
            to: hitsEnemyFirst && enemyPoint ? enemyPoint : hit?.point ?? edge,
            born: now,
          });
          nextLaserId += 1;
          lastShotAt.set(ship.id, now);
        }

        if (canFly && (input.up || input.down)) {
          let acc = (exhaustAcc.get(ship.id) ?? 0) + dt * EXHAUST_RATE;
          while (acc >= 1) {
            acc -= 1;
            if (input.up) spawnExhaust(ship.id, vertices, angle, SHIP_THRUSTER, 1, now);
            if (input.down) spawnExhaust(ship.id, vertices, angle, SHIP_NOSE, -1, now);
          }
          exhaustAcc.set(ship.id, acc);
        } else {
          exhaustAcc.set(ship.id, 0);
        }
      }

      lasers = lasers.filter((laser) => {
        if (!liveShips.has(laser.mappingId)) return false;
        return now - laser.born < LASER_MS;
      });
      exhaust = exhaust.filter((puff) => {
        if (!liveShips.has(puff.mappingId)) return false;
        if (now - puff.born >= puff.life) return false;
        puff.x += puff.vx * dt;
        puff.y += puff.vy * dt;
        return true;
      });
      if (exhaust.length > MAX_EXHAUST) exhaust = exhaust.slice(exhaust.length - MAX_EXHAUST);

      if (moved) useRoomStore.setState({ mappings });
      const anyFreeShip = ships.some(
        (ship) => game?.shipId === ship.id || !docks.get(ship.id) || docks.get(ship.id)?.phase === "free",
      );
      setThrustRumble(anyFreeShip && (input.up || input.down));
      publishPlay(now, mappings, state.surfaces);

      frame = requestAnimationFrame(tick);
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", onBlur);
    frame = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", onBlur);
      input = { ...emptyInput };
      restoreShipsToDocks();
      clearPlay();
      stopThrustRumble();
    };
  }, [presenting]);
}
