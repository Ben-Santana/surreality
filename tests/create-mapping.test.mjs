import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("mapping generator creates a typed definition bundle", () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), "projection-room-generator-"));
  const script = path.resolve("scripts/create-mapping.mjs");
  const result = spawnSync(process.execPath, [script, "test-light"], { cwd: project, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const directory = path.join(project, "src/specials/test-light");
  assert.deepEqual(fs.readdirSync(directory).sort(), ["TestLightView.tsx", "config.ts", "definition.ts"]);
  assert.match(fs.readFileSync(path.join(directory, "definition.ts"), "utf8"), /kind: "test-light"/);
});

test("mapping generator refuses to overwrite an existing mapping", () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), "projection-room-generator-"));
  const script = path.resolve("scripts/create-mapping.mjs");
  assert.equal(spawnSync(process.execPath, [script, "safe"], { cwd: project }).status, 0);
  assert.notEqual(spawnSync(process.execPath, [script, "safe"], { cwd: project }).status, 0);
});
