import type { Point } from "../../types";
import type { SoundPresetId } from "../sound/config";

export type ShipConfig = {
  angle: number;
  startsDocked: boolean;
  minigameEnabled: boolean;
  minigameKey: string;
  minigameHitSound: SoundPresetId;
  minigameHitVolume: number;
};

export const defaultShipConfig: ShipConfig = {
  angle: 0,
  startsDocked: false,
  minigameEnabled: false,
  minigameKey: "g",
  minigameHitSound: "pop",
  minigameHitVolume: 0.85,
};

export const SHIP_CONTENT_SIZE = { width: 96, height: 96 };
export const SHIP_VIEWBOX = 100;

/** Outline of the drawn ship in viewBox space, origin at the graphic center. */
export const SHIP_HULL: Point[] = [
  { x: 0, y: -36 },
  { x: 28, y: 32 },
  { x: -28, y: 32 },
];

export const SHIP_NOSE: Point = { x: 0, y: -36 };
export const SHIP_THRUSTER: Point = { x: 0, y: 32 };

export const TURN_SPEED = 3.1;
export const THRUST_SPEED = 220;
export const LINEAR_INERTIA = 3.2;
export const TURN_INERTIA = 4.4;
export const FIRE_COOLDOWN_MS = 140;
export const LASER_MS = 70;
export const LASER_WIDTH = 3;
export const LASER_SAMPLE = 3.5;
export const RECOIL_PX = 3;
export const DOCK_RADIUS = 31;
export const DOCK_CAPTURE_RADIUS = 38;
export const DOCK_TRANSITION_MS = 420;
export const CHARGE_IN = 7;
export const CHARGE_OUT = 10;
export const EXHAUST_RATE = 50;
export const EXHAUST_LIFE_MS = 980;
export const EXHAUST_LIFE_SPREAD_MS = 520;
export const EXHAUST_RADIUS = 11;
export const EXHAUST_RADIUS_SPREAD = 9;
export const EXHAUST_SPEED = 18;
export const EXHAUST_SPEED_SPREAD = 22;
export const EXHAUST_SPREAD = 16;
export const EXHAUST_SHRINK = 0.78;
