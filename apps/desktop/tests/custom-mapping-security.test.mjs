import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { inspectCustomMappingArchive } from "../electron/customMappings.ts";

function archive(overrides = {}, files = { "mapping.js": "export default () => null" }) {
  return { manifest: { manifestVersion: 2, id: "community.example", name: "Example", version: "1.0.0", configVersion: 1, description: "Test", geometry: "quad", contentSize: { width: 1920, height: 1080 }, defaultColor: { r: 255, g: 255, b: 255, a: 255 }, defaultConfig: {}, entrypoints: { mapping: "mapping.js" }, permissions: [], ...overrides }, files };
}

function inspect(value) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "surreality-package-"));
  const file = path.join(root, "package.surreality");
  try { fs.writeFileSync(file, JSON.stringify(value)); return inspectCustomMappingArchive(file); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
}

test("accepts a valid sandboxed community package", () => assert.equal(inspect(archive()).id, "community.example"));
test("rejects unsafe entrypoint paths", () => assert.throws(() => inspect(archive({ entrypoints: { mapping: "../mapping.js" } })), /Unsafe package path/));
test("requires unrestricted permission for native plugins", () => assert.throws(() => inspect(archive({ entrypoints: { mapping: "mapping.js", plugin: "plugin.js" } }, { "mapping.js": "", "plugin.js": "" })), /system:unrestricted/));
