import { useEffect } from "react";
import { asQuad, centroid, lerp, translateVertices } from "../../geometry";
import {
  clampHullAgainstOccupants,
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
import { useShipPlayStore, type ScreenBullet, type ScreenExhaust } from "./playStore";
import { resumeThrustAudio, setThrustRumble, stopThrustRumble } from "./thrustSound";
import { asConfig } from "../types";
import { emitSpecialEvent } from "../events";

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
};

const emptyInput: InputState = {
  left: false,
  right: false,
  up: false,
  down: false,
  fire: false,
};

type Motion = {
  vx: number;
  vy: number;
  omega: number;
};

const LINEAR_STOP = 10;
const TURN_STOP = 0.08;

const MAX_EXHAUST = 220;

let input: InputState = { ...emptyInput };
let lasers: LocalLaser[] = [];
let exhaust: LocalExhaust[] = [];
let nextLaserId = 1;
let nextExhaustId = 1;
const lastShotAt = new Map<string, number>();
const motions = new Map<string, Motion>();
const charges = new Map<string, number>();
const exhaustAcc = new Map<string, number>();

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

function isShip(mapping: Mapping): mapping is SpecialMapping {
  return isSpecialMapping(mapping) && mapping.kind === "ship";
}

function heading(angle: number): Point {
  return { x: Math.sin(angle), y: -Math.cos(angle) };
}

function shipConfig(mapping: SpecialMapping): ShipConfig {
  const current = asConfig(mapping, defaultShipConfig);
  return {
    angle: Number.isFinite(current.angle) ? current.angle : 0,
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
) {
  const pos = {
    x: local.x + (Math.random() - 0.5) * 10,
    y: local.y + awayY * Math.random() * 4,
  };
  const startRLocal = EXHAUST_RADIUS + Math.random() * EXHAUST_RADIUS_SPREAD;
  const speed = EXHAUST_SPEED + Math.random() * EXHAUST_SPEED_SPREAD;
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
    life: EXHAUST_LIFE_MS + Math.random() * EXHAUST_LIFE_SPREAD_MS,
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
  useShipPlayStore.getState().setPlay({
    bullets: screen,
    charges: nextCharges,
    exhaust: screenExhaust,
  });
}

function clearPlay() {
  lasers = [];
  exhaust = [];
  lastShotAt.clear();
  motions.clear();
  charges.clear();
  exhaustAcc.clear();
  setThrustRumble(false);
  useShipPlayStore.getState().setPlay({ bullets: [], charges: {}, exhaust: [] });
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
      const state = useRoomStore.getState();
      const ships = state.mappings.filter(isShip);
      if (ships.length === 0) {
        if (lasers.length > 0 || exhaust.length > 0) clearPlay();
        frame = requestAnimationFrame(tick);
        return;
      }

      let mappings = state.mappings;
      let moved = false;
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

      for (const ship of ships) {
        const config = shipConfig(ship);
        const bounds = playBounds(ship, state.surfaces);
        const motion = motionOf(ship.id);
        let targetOmega = 0;
        if (input.left) targetOmega -= TURN_SPEED;
        if (input.right) targetOmega += TURN_SPEED;
        motion.omega = approach(motion.omega, targetOmega, TURN_INERTIA, dt);
        if (Math.abs(motion.omega) < TURN_STOP && targetOmega === 0) motion.omega = 0;
        const angle = config.angle + motion.omega * dt;
        const nose = heading(angle);

        let targetVx = 0;
        let targetVy = 0;
        if (input.up) {
          targetVx += nose.x * THRUST_SPEED;
          targetVy += nose.y * THRUST_SPEED;
        }
        if (input.down) {
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

        const firing = input.fire && now - (lastShotAt.get(ship.id) ?? 0) >= FIRE_COOLDOWN_MS;
        const dx = motion.vx * dt + (firing ? -nose.x * RECOIL_PX : 0);
        const dy = motion.vy * dt + (firing ? -nose.y * RECOIL_PX : 0);
        const hull = shipHull(ship.vertices, angle);
        const againstWalls = clampTranslation(hull, dx, dy, bounds);
        const againstMaps = clampHullAgainstOccupants(
          hull,
          againstWalls.dx,
          againstWalls.dy,
          occupants(mappings, ship),
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

        setCharge(
          ship.id,
          approach(chargeOf(ship.id), input.fire ? 1 : 0, input.fire ? CHARGE_IN : CHARGE_OUT, dt),
        );

        if (firing) {
          const muzzle = shipLocalToWorld(vertices, angle, SHIP_NOSE);
          const origin = insideBounds(muzzle, bounds) ? muzzle : centroid(hull);
          const edge = rayExit(origin, nose, bounds);
          const hit = mappingHitAlong(occupants(mappings, ship), origin, edge, LASER_SAMPLE);
          if (hit) emitSpecialEvent({ type: "hit", sourceId: ship.id, targetId: hit.mapping.id, point: hit.point });
          lasers.push({
            id: nextLaserId,
            mappingId: ship.id,
            from: origin,
            to: hit?.point ?? edge,
            born: now,
          });
          nextLaserId += 1;
          lastShotAt.set(ship.id, now);
        }

        if (input.up || input.down) {
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
      setThrustRumble(input.up || input.down);
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
      clearPlay();
      stopThrustRumble();
    };
  }, [presenting]);
}
