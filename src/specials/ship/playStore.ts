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

type ShipPlayState = {
  bullets: ScreenBullet[];
  charges: Record<string, number>;
  exhaust: ScreenExhaust[];
  setPlay: (play: {
    bullets: ScreenBullet[];
    charges: Record<string, number>;
    exhaust: ScreenExhaust[];
  }) => void;
};

export const useShipPlayStore = create<ShipPlayState>((set) => ({
  bullets: [],
  charges: {},
  exhaust: [],
  setPlay: (play) => set(play),
}));
