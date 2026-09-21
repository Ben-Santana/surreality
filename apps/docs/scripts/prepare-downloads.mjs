import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Installers are release artifacts, not source files. Keep them out of Git,
// but require real files before building a site that advertises downloads.
const names = ["Surreality-1.0.0-arm64.dmg", "Surreality-Setup-1.0.0-x64.exe"];
const destination = new URL("../public/downloads/", import.meta.url);
mkdirSync(destination, { recursive: true });
for (const name of names) {
  const source = new URL(`../../desktop/release/${name}`, import.meta.url);
  const target = new URL(name, destination);
  if (existsSync(source)) copyFileSync(source, target);
  if (!existsSync(target)) {
    throw new Error(`Missing installer: ${name}. Build desktop releases or place the installer in ${fileURLToPath(destination)} before building the site.`);
  }
}
