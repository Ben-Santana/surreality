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
  const output = path.join(project, "packed.surreality");
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
  const archivePath = path.join(project, "installed.surreality");
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

test("reinstalling the same package version replaces its files", () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), "surreality-reinstaller-"));
  const archivePath = path.join(project, "replace.surreality");
  const userData = path.join(project, "user-data");
  const archive = {
    manifest: {
      manifestVersion: 2,
      id: "local.replace",
      name: "Replace",
      version: "1.0.0",
      configVersion: 1,
      description: "Replacement test",
      geometry: "quad",
      contentSize: { width: 640, height: 360 },
      defaultColor: { r: 255, g: 255, b: 255, a: 255 },
      defaultConfig: {},
      entrypoints: { mapping: "mapping.js" },
      permissions: [],
    },
    files: { "mapping.js": "export default 'first';" },
  };
  fs.writeFileSync(archivePath, JSON.stringify(archive));
  const moduleUrl = pathToFileURL(path.resolve("electron/customMappings.ts")).href;
  const code = `
    const fs = await import("node:fs");
    const api = await import(${JSON.stringify(moduleUrl)});
    const app = { getPath: () => ${JSON.stringify(userData)} };
    const archivePath = ${JSON.stringify(archivePath)};
    api.installCustomMappingArchive(app, archivePath);
    const archive = JSON.parse(fs.readFileSync(archivePath, "utf8"));
    archive.files["mapping.js"] = "export default 'second';";
    fs.writeFileSync(archivePath, JSON.stringify(archive));
    api.installCustomMappingArchive(app, archivePath);
    process.stdout.write(fs.readFileSync(${JSON.stringify(path.join(userData, "custom-mappings/local.replace/1.0.0/mapping.js"))}, "utf8"));
  `;
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "--eval", code], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "export default 'second';");
});

test("custom mapping archives are not bundled with the desktop app", () => {
  const directory = path.resolve("mappings");
  const files = fs.existsSync(directory)
    ? fs.readdirSync(directory).filter((name) => name.endsWith(".surreality"))
    : [];
  assert.deepEqual(files, []);
});
