import { create } from "zustand";

export type ScreenBullet = {
  id: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  color: { r: number; g: number; b: number; a: number };
  opacity: number;
};

export type ScreenExhaust = {
  id: number;
  x: number;
  y: number;
  r: number;
  opacity: number;
};

export type ScreenDock = {
  x: number;
  y: number;
  r: number;
  docked: boolean;
  transition: number;
  color: { r: number; g: number; b: number; a: number };
};

export type ScreenStar = { id: number; x: number; y: number; r: number; length: number; opacity: number };
export type ScreenEnemy = { id: number; x: number; y: number; r: number; opacity: number };

export type ShipGameView = {
  activeShipId: string | null;
  hiddenShipIds: string[];
  phase: "idle" | "centering" | "hyperspeed" | "playing" | "dying" | "respawning";
  stars: ScreenStar[];
  enemies: ScreenEnemy[];
  killCount: number;
};

export const idleShipGame: ShipGameView = {
  activeShipId: null,
  hiddenShipIds: [],
  phase: "idle",
  stars: [],
  enemies: [],
  killCount: 0,
};

type ShipPlayState = {
  bullets: ScreenBullet[];
  charges: Record<string, number>;
  exhaust: ScreenExhaust[];
  docks: Record<string, ScreenDock>;
  game: ShipGameView;
  setPlay: (play: Partial<Omit<ShipPlayState, "setPlay">>) => void;
};

export const useShipPlayStore = create<ShipPlayState>((set) => ({
  bullets: [],
  charges: {},
  exhaust: [],
  docks: {},
  game: idleShipGame,
  setPlay: (play) => set(play),
}));
