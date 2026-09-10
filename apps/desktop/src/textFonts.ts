import type { TextFontId } from "./types";

export const TEXT_FONTS: Array<{
  id: TextFontId;
  label: string;
  family: string;
  weight: number;
  tracking: number;
}> = [
  {
    id: "chakra",
    label: "Chakra",
    family: '"Chakra", "Avenir Next", Avenir, sans-serif',
    weight: 600,
    tracking: 0.035,
  },
  {
    id: "technical",
    label: "Avenir Next",
    family: '"Avenir Next", Avenir, sans-serif',
    weight: 500,
    tracking: -0.035,
  },
  {
    id: "expression",
    label: "Break a Few",
    family: '"Break a Few", sans-serif',
    weight: 400,
    tracking: -0.01,
  },
];

export const DEFAULT_TEXT_FONT: TextFontId = "chakra";

export function textFont(id?: TextFontId) {
  return TEXT_FONTS.find((font) => font.id === id) ?? TEXT_FONTS[0]!;
}
