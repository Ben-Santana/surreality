import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import test from "node:test";

test("mapping generator creates a code-powered package", () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), "surreality-generator-"));
  const script = path.resolve("scripts/create-mapping.mjs");
  const result = spawnSync(process.execPath, [script, "test-light"], { cwd: project, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const directory = path.join(project, "custom-mappings/test-light");
  assert.deepEqual(fs.readdirSync(directory).sort(), ["inspector.js", "manifest.json", "mapping.js"]);
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, "manifest.json"), "utf8"));
  assert.equal(manifest.id, "local.test-light");
  assert.equal(manifest.entrypoints.mapping, "mapping.js");
});

test("mapping generator refuses to overwrite an existing mapping", () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), "surreality-generator-"));
  const script = path.resolve("scripts/create-mapping.mjs");
  assert.equal(spawnSync(process.execPath, [script, "safe"], { cwd: project }).status, 0);
  assert.notEqual(spawnSync(process.execPath, [script, "safe"], { cwd: project }).status, 0);
});

test("packer creates an importable mapping archive", () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), "surreality-packer-"));
  const create = spawnSync(process.execPath, [path.resolve("scripts/create-mapping.mjs"), "packed"], { cwd: project, encoding: "utf8" });
  assert.equal(create.status, 0, create.stderr);
  const source = path.join(project, "custom-mappings/packed");
  const output = path.join(project, "packed.mapping");
  const pack = spawnSync(process.execPath, [path.resolve("scripts/pack-mapping.mjs"), source, output], { cwd: project, encoding: "utf8" });
  assert.equal(pack.status, 0, pack.stderr);
  const archive = JSON.parse(fs.readFileSync(output, "utf8"));
  assert.equal(archive.manifest.id, "local.packed");
  assert.ok(archive.files["mapping.js"].content.length > 0);
  assert.ok(archive.files["inspector.js"].content.length > 0);
});

test("installer validates, extracts, and lists a package", () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), "surreality-installer-"));
  const source = path.join(project, "custom-mappings/installed");
  assert.equal(spawnSync(process.execPath, [path.resolve("scripts/create-mapping.mjs"), "installed"], { cwd: project }).status, 0);
  const archivePath = path.join(project, "installed.mapping");
  assert.equal(spawnSync(process.execPath, [path.resolve("scripts/pack-mapping.mjs"), source, archivePath], { cwd: project }).status, 0);
  const userData = path.join(project, "user-data");
  const moduleUrl = pathToFileURL(path.resolve("electron/customMappings.ts")).href;
  const code = `
    const api = await import(${JSON.stringify(moduleUrl)});
    const app = { getPath: () => ${JSON.stringify(userData)} };
    const preview = api.inspectCustomMappingArchive(${JSON.stringify(archivePath)});
    const installed = api.installCustomMappingArchive(app, ${JSON.stringify(archivePath)});
    const listed = api.listInstalledCustomMappings(app);
    let handler;
    api.registerCustomMappingProtocol(app, { handle: (_scheme, next) => { handler = next; } });
    const host = await handler({ url: "surreality://package/local.installed/1.0.0/__host__.html?mode=mapping" });
    const sourceFile = await handler({ url: "surreality://package/local.installed/1.0.0/mapping.js" });
    process.stdout.write(JSON.stringify({
      preview: preview.id,
      installed: installed.manifest.id,
      listed: listed.length,
      host: (await host.text()).includes("./mapping.js"),
      source: (await sourceFile.text()).includes("export default function mount"),
      removed: api.uninstallCustomMapping(app, "local.installed", "1.0.0"),
      afterRemove: api.listInstalledCustomMappings(app).length
    }));
  `;
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "--eval", code], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { preview: "local.installed", installed: "local.installed", listed: 1, host: true, source: true, removed: true, afterRemove: 0 });
  assert.ok(!fs.existsSync(path.join(userData, "custom-mappings/local.installed/1.0.0")));
});

test("current mappings are distributed as reinstallable .mapping files", () => {
  const files = fs.readdirSync(path.resolve("mappings")).filter((name) => name.endsWith(".mapping")).sort();
  assert.deepEqual(files, [
    "room.mapping.dithered-media-1.0.0.mapping",
    "room.mapping.feynman-1.0.0.mapping",
    "room.mapping.media-1.0.0.mapping",
    "room.mapping.ship-1.0.0.mapping",
    "room.mapping.sound-1.0.0.mapping",
  ]);
  for (const file of files) {
    const archive = JSON.parse(fs.readFileSync(path.resolve("mappings", file), "utf8"));
    assert.equal(archive.manifest.manifestVersion, 1);
    assert.ok(archive.files[archive.manifest.entrypoints.mapping]);
  }
});
