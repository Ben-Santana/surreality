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

type ShipPlayState = {
  bullets: ScreenBullet[];
  charges: Record<string, number>;
  exhaust: ScreenExhaust[];
  docks: Record<string, ScreenDock>;
  setPlay: (play: {
    bullets: ScreenBullet[];
    charges: Record<string, number>;
    exhaust: ScreenExhaust[];
    docks: Record<string, ScreenDock>;
  }) => void;
};

export const useShipPlayStore = create<ShipPlayState>((set) => ({
  bullets: [],
  charges: {},
  exhaust: [],
  docks: {},
  setPlay: (play) => set(play),
}));
