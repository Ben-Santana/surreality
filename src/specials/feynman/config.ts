import type { Rgba } from "../../types";

export const FEYNMAN_EMOTIONS = [
  "neutral",
  "attentive",
  "confused",
  "wary",
  "excited",
] as const;

export type FeynmanEmotion = (typeof FEYNMAN_EMOTIONS)[number];

export const FEYNMAN_SHAPES = [
  "circle",
  "triangle",
  "square",
  "pentagon",
  "hexagon",
  "octagon",
] as const;

export type FeynmanShape = (typeof FEYNMAN_SHAPES)[number];

export type FeynmanConfig = {
  emotion: FeynmanEmotion;
  look: boolean;
  burstKey: number;
  eyeColor: Rgba;
  shape: FeynmanShape;
};

export const defaultFeynmanConfig: FeynmanConfig = {
  emotion: "attentive",
  look: true,
  burstKey: 0,
  eyeColor: { r: 249, g: 249, b: 249, a: 255 },
  shape: "hexagon",
};

export const FEYNMAN_EMOTION_LABELS: Record<FeynmanEmotion, string> = {
  neutral: "Neutral",
  attentive: "Attentive",
  confused: "Confused",
  wary: "Wary",
  excited: "Excited",
};

export const FEYNMAN_SHAPE_LABELS: Record<FeynmanShape, string> = {
  circle: "Circle",
  triangle: "Triangle",
  square: "Square",
  pentagon: "Pentagon",
  hexagon: "Hexagon",
  octagon: "Octagon",
};
