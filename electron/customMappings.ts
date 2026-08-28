import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { App, Protocol } from "electron";
import type {
  CustomMappingPackageManifest,
  CustomMappingPackageRecord,
  CustomMappingPermission,
} from "../src/types";

type PackageFile = { encoding: "utf8" | "base64"; content: string };
type PackageArchive = { manifest: unknown; files: Record<string, PackageFile | string> };

const MAX_ARCHIVE_BYTES = 50 * 1024 * 1024;
const MAX_FILES = 512;
const PACKAGE_ID = /^[a-z0-9]+(?:[._-][a-z0-9]+)+$/;
const VERSION = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const PERMISSIONS = new Set<CustomMappingPermission>([
  "audio:play",
  "events:room",
  "input:keyboard",
  "input:pointer",
  "microphone:read",
  "network:fetch",
  "storage:package",
  "files:user-selected",
]);

function packagesRoot(app: App) {
  return path.join(app.getPath("userData"), "custom-mappings");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeRelativePath(value: unknown): string {
  if (typeof value !== "string" || !value || value.includes("\\") || !/^[A-Za-z0-9._/-]+$/.test(value)) {
    throw new Error("Package paths must be non-empty forward-slash paths");
  }
  const normalized = path.posix.normalize(value);
  if (normalized.startsWith("/") || normalized === ".." || normalized.startsWith("../")) {
    throw new Error(`Unsafe package path: ${value}`);
  }
  return normalized;
}

function positiveSize(value: unknown, name: string) {
  if (!isRecord(value)) throw new Error(`${name} must be an object`);
  const width = value.width;
  const height = value.height;
  if (typeof width !== "number" || typeof height !== "number" || width <= 0 || height <= 0 || width > 8192 || height > 8192) {
    throw new Error(`${name} must contain positive width and height values no larger than 8192`);
  }
  return { width, height };
}

export function validateManifest(value: unknown): CustomMappingPackageManifest {
  if (!isRecord(value)) throw new Error("manifest must be an object");
  if (value.manifestVersion !== 1) throw new Error("Unsupported manifestVersion");
  if (typeof value.id !== "string" || !PACKAGE_ID.test(value.id)) throw new Error("Invalid package id");
  if (typeof value.version !== "string" || !VERSION.test(value.version)) throw new Error("Invalid package version");
  if (typeof value.name !== "string" || !value.name.trim() || value.name.length > 80) throw new Error("Invalid package name");
  if (typeof value.description !== "string" || value.description.length > 500) throw new Error("Invalid package description");
  if (typeof value.configVersion !== "number" || !Number.isInteger(value.configVersion) || value.configVersion < 1) throw new Error("Invalid configVersion");
  if (!isRecord(value.defaultColor)) throw new Error("defaultColor must be an object");
  const color = value.defaultColor;
  for (const channel of ["r", "g", "b", "a"] as const) {
    if (typeof color[channel] !== "number" || color[channel] < 0 || color[channel] > 255) throw new Error(`Invalid defaultColor.${channel}`);
  }
  if (!isRecord(value.defaultConfig)) throw new Error("defaultConfig must be an object");
  if (value.geometry !== "quad" && value.geometry !== "polygon" && value.geometry !== "circle") throw new Error("Invalid geometry");
  if (!isRecord(value.entrypoints)) throw new Error("entrypoints must be an object");
  const entrypoints = {
    mapping: safeRelativePath(value.entrypoints.mapping),
    ...(value.entrypoints.inspector ? { inspector: safeRelativePath(value.entrypoints.inspector) } : {}),
    ...(value.entrypoints.runtime ? { runtime: safeRelativePath(value.entrypoints.runtime) } : {}),
  };
  const permissions = Array.isArray(value.permissions) ? value.permissions : [];
  if (!permissions.every((permission): permission is CustomMappingPermission => typeof permission === "string" && PERMISSIONS.has(permission as CustomMappingPermission))) {
    throw new Error("Manifest contains an unknown permission");
  }
  const author = isRecord(value.author) && typeof value.author.name === "string"
    ? { name: value.author.name, ...(typeof value.author.url === "string" ? { url: value.author.url } : {}) }
    : undefined;
  return {
    manifestVersion: 1,
    id: value.id,
    name: value.name.trim(),
    version: value.version,
    configVersion: value.configVersion,
    description: value.description,
    ...(author ? { author } : {}),
    ...(typeof value.minimumAppVersion === "string" ? { minimumAppVersion: value.minimumAppVersion } : {}),
    geometry: value.geometry,
    contentSize: positiveSize(value.contentSize, "contentSize"),
    defaultColor: { r: color.r as number, g: color.g as number, b: color.b as number, a: color.a as number },
    defaultConfig: value.defaultConfig,
    entrypoints,
    permissions,
    ...(typeof value.thumbnail === "string" ? { thumbnail: safeRelativePath(value.thumbnail) } : {}),
  };
}

function packageDirectory(app: App, id: string, version: string) {
  if (!PACKAGE_ID.test(id) || !VERSION.test(version)) throw new Error("Invalid package identity");
  return path.join(packagesRoot(app), id, version);
}

export function listInstalledCustomMappings(app: App): CustomMappingPackageRecord[] {
  const root = packagesRoot(app);
  if (!fs.existsSync(root)) return [];
  const result: CustomMappingPackageRecord[] = [];
  for (const packageId of fs.readdirSync(root)) {
    const idDirectory = path.join(root, packageId);
    if (!fs.statSync(idDirectory).isDirectory()) continue;
    for (const version of fs.readdirSync(idDirectory)) {
      try {
        const manifest = validateManifest(JSON.parse(fs.readFileSync(path.join(idDirectory, version, "manifest.json"), "utf8")));
        result.push({ manifest, source: "installed", enabled: true });
      } catch (error) {
        console.warn(`Ignoring invalid custom mapping ${packageId}/${version}`, error);
      }
    }
  }
  return result.sort((a, b) => `${a.manifest.id}@${a.manifest.version}`.localeCompare(`${b.manifest.id}@${b.manifest.version}`));
}

export function installCustomMappingArchive(app: App, archivePath: string): CustomMappingPackageRecord {
  const stat = fs.statSync(archivePath);
  if (!stat.isFile() || stat.size > MAX_ARCHIVE_BYTES) throw new Error("Mapping package is missing or larger than 50 MB");
  const archive = JSON.parse(fs.readFileSync(archivePath, "utf8")) as PackageArchive;
  const manifest = validateManifest(archive.manifest);
  if (!isRecord(archive.files)) throw new Error("Package files must be an object");
  const entries = Object.entries(archive.files);
  if (entries.length === 0 || entries.length > MAX_FILES) throw new Error(`Packages must contain between 1 and ${MAX_FILES} files`);
  const files = new Map<string, Buffer>();
  let expandedBytes = 0;
  for (const [rawPath, rawFile] of entries) {
    const relative = safeRelativePath(rawPath);
    const file = typeof rawFile === "string" ? { encoding: "utf8" as const, content: rawFile } : rawFile;
    if (!file || (file.encoding !== "utf8" && file.encoding !== "base64") || typeof file.content !== "string") throw new Error(`Invalid file record for ${relative}`);
    const contents = Buffer.from(file.content, file.encoding === "base64" ? "base64" : "utf8");
    expandedBytes += contents.byteLength;
    if (expandedBytes > MAX_ARCHIVE_BYTES) throw new Error("Expanded package is larger than 50 MB");
    files.set(relative, contents);
  }
  for (const entry of Object.values(manifest.entrypoints)) {
    if (entry && !files.has(entry)) throw new Error(`Missing entrypoint: ${entry}`);
  }
  const target = packageDirectory(app, manifest.id, manifest.version);
  if (fs.existsSync(path.join(target, "manifest.json"))) {
    const installed = validateManifest(JSON.parse(fs.readFileSync(path.join(target, "manifest.json"), "utf8")));
    return { manifest: installed, source: "installed", enabled: true };
  }
  const parent = path.dirname(target);
  const temporary = path.join(parent, `.install-${crypto.randomUUID()}`);
  fs.mkdirSync(parent, { recursive: true });
  fs.mkdirSync(temporary);
  try {
    for (const [relative, contents] of files) {
      const destination = path.resolve(temporary, relative);
      if (!destination.startsWith(`${path.resolve(temporary)}${path.sep}`)) throw new Error(`Unsafe package path: ${relative}`);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, contents, { flag: "wx" });
    }
    fs.writeFileSync(path.join(temporary, "manifest.json"), JSON.stringify(manifest, null, 2), { flag: "wx" });
    fs.renameSync(temporary, target);
  } catch (error) {
    fs.rmSync(temporary, { recursive: true, force: true });
    throw error;
  }
  return { manifest, source: "installed", enabled: true };
}

export function inspectCustomMappingArchive(archivePath: string): CustomMappingPackageManifest {
  const stat = fs.statSync(archivePath);
  if (!stat.isFile() || stat.size > MAX_ARCHIVE_BYTES) throw new Error("Mapping package is missing or larger than 50 MB");
  const archive = JSON.parse(fs.readFileSync(archivePath, "utf8")) as PackageArchive;
  return validateManifest(archive.manifest);
}

function contentType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  return ({
    ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".webp": "image/webp", ".gif": "image/gif", ".mp3": "audio/mpeg", ".wav": "audio/wav",
    ".mp4": "video/mp4", ".webm": "video/webm", ".woff2": "font/woff2",
  } as Record<string, string>)[extension] ?? "application/octet-stream";
}

function hostHtml(manifest: CustomMappingPackageManifest, mode: "mapping" | "inspector" | "runtime", nonce: string) {
  const entry = mode === "inspector"
    ? manifest.entrypoints.inspector
    : mode === "runtime"
      ? manifest.entrypoints.runtime
      : manifest.entrypoints.mapping;
  if (!entry) return "<!doctype html><body style='margin:0;background:transparent;color:white'>No inspector supplied.</body>";
  const script = `
const root = document.getElementById("root");
let current = null;
let api = null;
const send = (type, payload = {}) => parent.postMessage({ source: "projection-room-mapping", type, ...payload }, "*");
try {
  const module = await import(${JSON.stringify(`./${entry}`)});
  api = module.default ?? module;
  send("ready");
} catch (error) {
  send("log", { level: "error", message: error instanceof Error ? error.stack : String(error) });
  root.textContent = "Mapping failed to load";
}
addEventListener("message", async (event) => {
  const message = event.data;
  if (!message || message.source !== "projection-room-host") return;
  if (message.type === "event") {
    const handler = current?.onEvent ?? api?.onEvent;
    if (typeof handler === "function") await handler(message.event);
    return;
  }
  if (message.type === "input") {
    const handler = current?.onInput ?? api?.onInput;
    if (typeof handler === "function") await handler(message.input);
    return;
  }
  if ((message.type !== "initialize" && message.type !== "update") || !api) return;
  if (message.type === "update" && message.mode === "inspector") return;
  try {
    if (typeof current === "function") current();
    else if (current && typeof current.destroy === "function") current.destroy();
    root.replaceChildren();
    const mapping = message.mapping;
    const context = {
      root,
      mode: message.mode,
      mapping,
      manifest: message.manifest,
      config: mapping.config,
      color: mapping.color,
      assets: { url: (relativePath) => new URL(relativePath, location.href).href },
      updateConfig: (config) => send("update-config", { config }),
      emit: (mappingEvent) => send("emit-event", { event: mappingEvent }),
      log: (...parts) => send("log", { level: "log", message: parts.map(String).join(" ") }),
    };
    const mount = typeof api === "function" ? api : api.mount ?? api.mountMapping ?? api.mountInspector;
    if (typeof mount !== "function") throw new Error("Entrypoint must export a mount function");
    current = await mount(context);
  } catch (error) {
    send("log", { level: "error", message: error instanceof Error ? error.stack : String(error) });
    root.textContent = "Mapping stopped because of an error";
  }
});`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{width:100%;height:100%;margin:0;overflow:hidden;background:transparent}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" nonce="${nonce}">${script}</script></body></html>`;
}

export function registerCustomMappingProtocol(app: App, protocol: Protocol) {
  protocol.handle("room-mapping", (request) => {
    try {
      const url = new URL(request.url);
      const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
      const [id, version, ...fileParts] = parts;
      if (url.hostname !== "package" || !id || !version || fileParts.length === 0) return new Response("Not found", { status: 404 });
      const manifestPath = path.join(packageDirectory(app, id, version), "manifest.json");
      const manifest = validateManifest(JSON.parse(fs.readFileSync(manifestPath, "utf8")));
      const nonce = crypto.randomBytes(16).toString("base64");
      const network = manifest.permissions?.includes("network:fetch") ? "https: http:" : "";
      const csp = `default-src 'none'; script-src room-mapping: 'nonce-${nonce}'; style-src room-mapping: 'unsafe-inline'; img-src room-mapping: data: blob:; media-src room-mapping: data: blob:; font-src room-mapping: data:; connect-src room-mapping: ${network}`;
      if (fileParts.join("/") === "__host__.html") {
        const requestedMode = url.searchParams.get("mode");
        const mode = requestedMode === "inspector" || requestedMode === "runtime" ? requestedMode : "mapping";
        return new Response(hostHtml(manifest, mode, nonce), { headers: { "content-type": "text/html; charset=utf-8", "content-security-policy": csp } });
      }
      const relative = safeRelativePath(fileParts.join("/"));
      const root = packageDirectory(app, id, version);
      const filePath = path.resolve(root, relative);
      if (!filePath.startsWith(`${path.resolve(root)}${path.sep}`) || !fs.statSync(filePath).isFile()) return new Response("Not found", { status: 404 });
      return new Response(fs.readFileSync(filePath), { headers: { "content-type": contentType(filePath), "access-control-allow-origin": "*", "content-security-policy": csp } });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
}
