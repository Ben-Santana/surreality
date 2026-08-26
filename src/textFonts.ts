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
    family: '"Chakra Petch", ui-sans-serif, system-ui, sans-serif',
    weight: 600,
    tracking: 0.035,
  },
  {
    id: "mono",
    label: "Signal",
    family: '"Share Tech Mono", ui-monospace, monospace',
    weight: 400,
    tracking: 0.06,
  },
  {
    id: "grotesk",
    label: "Grotesk",
    family: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    weight: 700,
    tracking: -0.025,
  },
  {
    id: "editorial",
    label: "Editorial",
    family: 'Georgia, "Times New Roman", serif',
    weight: 400,
    tracking: -0.015,
  },
];

export const DEFAULT_TEXT_FONT: TextFontId = "chakra";

export function textFont(id?: TextFontId) {
  return TEXT_FONTS.find((font) => font.id === id) ?? TEXT_FONTS[0]!;
}
