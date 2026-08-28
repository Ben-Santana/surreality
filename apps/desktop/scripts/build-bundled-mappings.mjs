import fs from "node:fs";
import path from "node:path";

const outputDirectory = path.resolve("mappings");
const nativeEntrypoint = "// This package is rendered by Surreality's native compatibility runtime.\nexport default function mount() {}\n";
const common = {
  manifestVersion: 2,
  version: "1.0.0",
  configVersion: 1,
  author: { name: "Surreality" },
  entrypoints: { mapping: "mapping.js" },
  bundled: true,
};

const manifests = [
  { ...common, id: "room.mapping.media", name: "Media", description: "Warp an MP4, animated GIF, or still image onto a surface.", geometry: "quad", contentSize: { width: 480, height: 270 }, defaultColor: { r: 255, g: 255, b: 255, a: 255 }, defaultConfig: { source: "", fileName: "", mediaType: "video", fit: "cover", loop: true, muted: true, autoplay: true }, permissions: [] },
  { ...common, id: "room.mapping.dithered-media", name: "Dithered Media", description: "Warp an MP4, GIF, or still image with print-style dithering.", geometry: "quad", contentSize: { width: 480, height: 270 }, defaultColor: { r: 255, g: 255, b: 255, a: 255 }, defaultConfig: { source: "", fileName: "", mediaType: "video", fit: "cover", loop: true, muted: true, autoplay: true, algorithm: "atkinson", palette: "mono", pixelSize: 3, threshold: 128, contrast: 1.15, invert: false }, permissions: [] },
  { ...common, id: "room.mapping.feynman", name: "Feynman", description: "Bloub, the Feynman character. Warp the quad onto a wall or object.", geometry: "quad", contentSize: { width: 250, height: 250 }, defaultColor: { r: 232, g: 72, b: 63, a: 255 }, defaultConfig: { emotion: "attentive", look: true, burstKey: 0, eyeColor: { r: 249, g: 249, b: 249, a: 255 }, shape: "hexagon" }, permissions: [] },
  { ...common, id: "room.mapping.sound", name: "Sound", description: "Click a polygon or circle to play a preset or your own WAV.", geometry: "polygon", contentSize: { width: 180, height: 150 }, defaultColor: { r: 255, g: 140, b: 60, a: 210 }, defaultConfig: { geometry: "polygon", source: "preset", preset: "click", customAudio: null, customName: null, volume: 0.85 }, permissions: ["input:pointer", "events:room"] },
  { ...common, id: "room.mapping.ship", name: "Ship", description: "Fly with arrows, fire with space, and optionally launch from a dock.", geometry: "quad", contentSize: { width: 96, height: 96 }, defaultColor: { r: 110, g: 210, b: 255, a: 255 }, defaultConfig: { angle: 0, startsDocked: false, minigameEnabled: false, minigameKey: "g", minigameHitSound: "pop", minigameHitVolume: 0.85 }, permissions: [] },
];

fs.mkdirSync(outputDirectory, { recursive: true });
for (const manifest of manifests) {
  const archive = {
    manifest,
    files: { "mapping.js": { encoding: "utf8", content: nativeEntrypoint } },
  };
  fs.writeFileSync(path.join(outputDirectory, `${manifest.id}-${manifest.version}.surreality`), `${JSON.stringify(archive)}\n`);
}
console.log(`Built ${manifests.length} mapping packages in ${path.relative(process.cwd(), outputDirectory)}`);
