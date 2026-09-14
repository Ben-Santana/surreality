import { createRequire } from "node:module";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { BrowserWindow as ElectronWindow, MessageBoxOptions, OpenDialogOptions } from "electron";
import { customMappingHasPermission, inspectCustomMappingArchive, installCustomMappingArchive, listInstalledCustomMappings, registerCustomMappingProtocol, uninstallCustomMapping } from "./customMappings";
import { CloudService } from "./cloud";
import { LocalDataStore } from "./persistence";
import { startPackagePlugins, stopPackagePlugins } from "./plugins";

const { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, protocol, safeStorage, screen, session } = createRequire(import.meta.url)(
  "electron",
) as typeof import("electron");

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const RENDERER_DIST = path.join(__dirname, "../dist");
const APP_ICON_PATH = VITE_DEV_SERVER_URL
  ? path.join(__dirname, "../public/surreality-mark.png")
  : path.join(RENDERER_DIST, "surreality-mark.png");

protocol.registerSchemesAsPrivileged([
  { scheme: "surreality", privileges: { secure: true, standard: true, supportFetchAPI: true, corsEnabled: true } },
  { scheme: "surreality-asset", privileges: { secure: true, standard: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

let editorWindow: ElectronWindow | null = null;
let outputWindow: ElectronWindow | null = null;
let controlsWindow: ElectronWindow | null = null;
let lastPayload: unknown = null;
let lastControlsState: unknown = null;
let localData: LocalDataStore | null = null;
let cloud: CloudService | null = null;

function prepareThumbnail(filePath: string) {
  const maximumBytes = 2 * 1024 * 1024;
  const stat = fs.statSync(filePath);
  if (stat.size > 0 && stat.size <= maximumBytes) return { filePath, cleanup: () => undefined };
  const source = nativeImage.createFromPath(filePath);
  if (source.isEmpty()) throw new Error("The selected thumbnail is not a readable image.");
  let size = source.getSize();
  const initialScale = Math.min(1, 1600 / Math.max(size.width, size.height));
  size = { width: Math.max(1, Math.round(size.width * initialScale)), height: Math.max(1, Math.round(size.height * initialScale)) };
  let image = source.resize({ ...size, quality: "best" });
  let quality = 88;
  let contents = image.toJPEG(quality);
  while (contents.byteLength > maximumBytes && Math.max(size.width, size.height) > 480) {
    size = { width: Math.max(1, Math.round(size.width * 0.8)), height: Math.max(1, Math.round(size.height * 0.8)) };
    image = source.resize({ ...size, quality: "best" });
    quality = Math.max(58, quality - 6);
    contents = image.toJPEG(quality);
  }
  if (contents.byteLength > maximumBytes) throw new Error("The selected image could not be reduced below 2 MB.");
  const temporary = path.join(app.getPath("temp"), `surreality-thumbnail-${crypto.randomUUID()}.jpg`);
  fs.writeFileSync(temporary, contents, { flag: "wx", mode: 0o600 });
  return { filePath: temporary, cleanup: () => fs.rmSync(temporary, { force: true }) };
}

function assetResponse(request: Request) {
  if (!localData) return new Response("Storage unavailable", { status: 503 });
  const url = new URL(request.url);
  const sha256 = url.pathname.split("/").filter(Boolean)[0] ?? "";
  const asset = localData.assetByHash(sha256);
  if (url.hostname !== "local" || !asset || !fs.existsSync(asset.local_path)) {
    return new Response("Asset not found", { status: 404 });
  }
  const range = request.headers.get("range");
  if (range) {
    const match = /^bytes=(\d+)-(\d*)$/.exec(range);
    if (match) {
      const start = Number(match[1]);
      const requestedEnd = match[2] ? Number(match[2]) : asset.byte_size - 1;
      const end = Math.min(asset.byte_size - 1, requestedEnd);
      if (start <= end && start < asset.byte_size) {
        const length = end - start + 1;
        const descriptor = fs.openSync(asset.local_path, "r");
        const body = Buffer.allocUnsafe(length);
        try {
          fs.readSync(descriptor, body, 0, length, start);
        } finally {
          fs.closeSync(descriptor);
        }
        return new Response(body, {
          status: 206,
          headers: {
            "accept-ranges": "bytes",
            "content-length": String(length),
            "content-range": `bytes ${start}-${end}/${asset.byte_size}`,
            "content-type": asset.mime_type,
          },
        });
      }
    }
    return new Response(null, { status: 416, headers: { "content-range": `bytes */${asset.byte_size}` } });
  }
  return new Response(fs.readFileSync(asset.local_path), {
    headers: {
      "accept-ranges": "bytes",
      "content-length": String(asset.byte_size),
      "content-type": asset.mime_type,
      "cache-control": "private, max-age=31536000, immutable",
    },
  });
}

function preloadPath() {
  const mjs = path.join(__dirname, "preload.mjs");
  const js = path.join(__dirname, "preload.js");
  return fs.existsSync(mjs) ? mjs : js;
}

function versionIsOlder(current: string, minimum: string) {
  const parts = (value: string) => value.split(/[.-]/, 3).map((item) => Number.parseInt(item, 10) || 0);
  const left = parts(current);
  const right = parts(minimum);
  for (let index = 0; index < 3; index += 1) {
    if ((left[index] ?? 0) !== (right[index] ?? 0)) return (left[index] ?? 0) < (right[index] ?? 0);
  }
  return false;
}

function loadWindow(win: ElectronWindow, search = "") {
  if (VITE_DEV_SERVER_URL) {
    void win.loadURL(`${VITE_DEV_SERVER_URL}${search}`);
  } else {
    void win.loadFile(path.join(RENDERER_DIST, "index.html"), search ? { search } : {});
  }
}

function createEditor() {
  editorWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1080,
    minHeight: 720,
    show: false,
    backgroundColor: "#07070a",
    icon: APP_ICON_PATH,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 14, y: 16 },
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  editorWindow.once("ready-to-show", () => editorWindow?.show());
  editorWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.includes("mode=controls")) return { action: "deny" };
    return {
      action: "allow",
      overrideBrowserWindowOptions: {
        minWidth: 560,
        minHeight: 420,
        frame: false,
        backgroundColor: "#111114",
        title: "Room Controls",
        webPreferences: {
          preload: preloadPath(),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: false,
        },
      },
    };
  });
  editorWindow.webContents.on("did-create-window", (window, details) => {
    if (!details.url.includes("mode=controls")) return;
    controlsWindow = window;
    window.on("closed", () => {
      if (controlsWindow === window) controlsWindow = null;
      editorWindow?.webContents.send("controls-closed");
    });
    window.webContents.on("did-finish-load", () => {
      if (lastControlsState != null && !window.isDestroyed()) {
        window.webContents.send("controls-sync", lastControlsState);
      }
    });
  });
  editorWindow.on("closed", () => {
    editorWindow = null;
    outputWindow?.close();
    controlsWindow?.close();
  });

  loadWindow(editorWindow);
}

function createOutput(displayId?: number) {
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  const display =
    displays.find((item) => item.id === displayId) ??
    displays.find((item) => item.id !== primary.id) ??
    primary;

  outputWindow?.close();

  const fullscreen = display.id !== primary.id || displays.length > 1;
  outputWindow = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    frame: false,
    fullscreen,
    simpleFullscreen: fullscreen,
    autoHideMenuBar: true,
    backgroundColor: "#000000",
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  outputWindow.on("closed", () => {
    outputWindow = null;
    editorWindow?.webContents.send("output-closed");
  });

  outputWindow.webContents.on("did-finish-load", () => {
    if (lastPayload != null) {
      outputWindow?.webContents.send("sync", lastPayload);
    }
  });

  loadWindow(outputWindow, "?mode=output");
}

function createControls() {
  if (controlsWindow) {
    controlsWindow.show();
    controlsWindow.focus();
    return;
  }
  controlsWindow = new BrowserWindow({
    width: 760,
    height: 720,
    minWidth: 560,
    minHeight: 420,
    show: true,
    backgroundColor: "#111114",
    title: "Room Controls",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 14, y: 16 },
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  controlsWindow.on("closed", () => {
    controlsWindow = null;
    editorWindow?.webContents.send("controls-closed");
  });
  controlsWindow.webContents.on("did-finish-load", () => {
    if (lastControlsState != null) controlsWindow?.webContents.send("controls-sync", lastControlsState);
  });
  loadWindow(controlsWindow, "?mode=controls");
  controlsWindow.focus();
}

function installMenu() {
  const sendHistory = (channel: "history-undo" | "history-redo") => {
    editorWindow?.webContents.send(channel);
  };

  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(process.platform === "darwin" ? [{ role: "appMenu" as const }] : []),
      {
        label: "Edit",
        submenu: [
          {
            label: "Undo",
            accelerator: "CmdOrCtrl+Z",
            click: () => sendHistory("history-undo"),
          },
          {
            label: "Redo",
            accelerator: "Shift+CmdOrCtrl+Z",
            click: () => sendHistory("history-redo"),
          },
          { type: "separator" },
          { role: "cut" },
          { role: "copy" },
          { role: "paste" },
          { role: "selectAll" },
        ],
      },
      { role: "viewMenu" },
      { role: "windowMenu" },
    ]),
  );
}

app.whenReady().then(() => {
  app.setName("Surreality");
  const appIcon = nativeImage.createFromPath(APP_ICON_PATH);
  if (!appIcon.isEmpty()) app.dock?.setIcon(appIcon);
  localData = new LocalDataStore(app.getPath("userData"));
  cloud = new CloudService(
    localData,
    app.getPath("userData"),
    safeStorage,
    (state) => { for (const window of BrowserWindow.getAllWindows()) window.webContents.send("cloud:state", state); },
    (progress) => { for (const window of BrowserWindow.getAllWindows()) window.webContents.send("community:progress", progress); },
  );
  const cameraAllowed = (requestingUrl: string, mediaType?: string) =>
    (!mediaType || mediaType === "video") && customMappingHasPermission(app, requestingUrl, "camera:read");
  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    if (permission !== "media" || (details.mediaType && details.mediaType !== "video")) return false;
    const requestingUrl = details.requestingUrl ?? details.securityOrigin ?? requestingOrigin;
    if (cameraAllowed(requestingUrl, details.mediaType)) return true;
    return webContents?.mainFrame.frames.some((frame) => cameraAllowed(frame.url, details.mediaType)) ?? false;
  });
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback, details) => {
    const media = details as import("electron").MediaAccessPermissionRequest;
    const videoOnly = !media.mediaTypes || (media.mediaTypes.includes("video") && !media.mediaTypes.includes("audio"));
    callback(permission === "media" && videoOnly && cameraAllowed(media.requestingUrl, "video"));
  });
  installMenu();
  registerCustomMappingProtocol(app, protocol);
  protocol.handle("surreality-asset", assetResponse);
  createEditor();
  const installedCustomMappings = () => listInstalledCustomMappings(app, (id, version) => localData?.packageInstallSource(id, version));
  const refreshPlugins = () => startPackagePlugins(app, installedCustomMappings(), (payload) => {
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send("plugin:data", payload);
  });
  refreshPlugins();

  ipcMain.handle("displays", () =>
    screen.getAllDisplays().map((display) => ({
      id: display.id,
      label: display.label || `Display ${display.id}`,
      bounds: display.bounds,
      primary: display.id === screen.getPrimaryDisplay().id,
    })),
  );

  ipcMain.handle("open-output", (_event, displayId?: number) => {
    createOutput(displayId);
  });

  ipcMain.handle("close-output", () => {
    outputWindow?.close();
  });

  ipcMain.handle("open-controls", () => createControls());
  ipcMain.handle("close-controls", () => controlsWindow?.close());
  ipcMain.handle("controls-open", () => controlsWindow != null);
  ipcMain.handle("controls-state", () => lastControlsState);
  ipcMain.handle("persistence:get", (_event, name: string) => localData?.readPersistedState(name) ?? null);
  ipcMain.on("persistence:put", (_event, name: string, value: string) => {
    localData?.queuePersistedState(name, value);
  });
  ipcMain.handle("persistence:flush", () => localData?.flushSnapshot());
  ipcMain.handle("assets:import", async (_event, kind: "media" | "audio") => {
    if (!localData) throw new Error("Local storage is unavailable.");
    const options: OpenDialogOptions = {
      title: kind === "audio" ? "Choose a sound" : "Choose media",
      properties: ["openFile"],
      filters: kind === "audio"
        ? [{ name: "Audio", extensions: ["wav", "mp3", "ogg"] }]
        : [
            { name: "Media", extensions: ["mp4", "webm", "gif", "png", "jpg", "jpeg", "webp", "avif", "bmp", "svg"] },
          ],
    };
    const result = editorWindow
      ? await dialog.showOpenDialog(editorWindow, options)
      : await dialog.showOpenDialog(options);
    const selected = result.filePaths[0];
    if (result.canceled || !selected) return { canceled: true };
    const extension = path.extname(selected).toLowerCase();
    const allowed = kind === "audio"
      ? new Set([".wav", ".mp3", ".ogg"])
      : new Set([".mp4", ".webm", ".gif", ".png", ".jpg", ".jpeg", ".webp", ".avif", ".bmp", ".svg"]);
    if (!allowed.has(extension)) throw new Error(kind === "audio" ? "Choose a WAV, MP3, or OGG file." : "Choose an MP4, WebM, or supported image file.");
    const asset = localData.importAsset(selected, kind === "audio" ? 1_500_000 : 12 * 1024 * 1024);
    return { canceled: false, asset };
  });
  ipcMain.handle("cloud:configure", (_event, url: string, publishableKey: string) => cloud?.configure(url, publishableKey));
  ipcMain.handle("cloud:state", () => cloud?.state());
  ipcMain.handle("cloud:sign-up", (_event, email: string, password: string) => cloud?.signUp(email, password));
  ipcMain.handle("cloud:sign-in", (_event, email: string, password: string) => cloud?.signIn(email, password));
  ipcMain.handle("cloud:sign-out", () => cloud?.signOut());
  ipcMain.handle("cloud:password-reset", (_event, email: string) => cloud?.sendPasswordReset(email));
  ipcMain.handle("cloud:password-recover", (_event, email: string, token: string, newPassword: string) => cloud?.verifyPasswordRecovery(email, token, newPassword));
  ipcMain.handle("community:browse", (_event, options) => cloud?.browse(options));
  ipcMain.handle("community:get-package", (_event, packageId: string) => cloud?.getPackage(packageId));
  ipcMain.handle("community:list-downloads", () => cloud?.listDownloads());
  ipcMain.handle("community:list-saved", () => cloud?.listSaved());
  ipcMain.handle("community:list-uploads", () => cloud?.listUploads());
  ipcMain.handle("community:list-moderation", () => cloud?.listModerationQueue());
  ipcMain.handle("community:set-username", (_event, username: string) => cloud?.setUsername(username));
  ipcMain.handle("community:upload", async () => {
    if (!cloud) throw new Error("Community service is unavailable.");
    const options: OpenDialogOptions = { title: "Publish a Surreality package", properties: ["openFile"], filters: [{ name: "Surreality Package", extensions: ["surreality"] }] };
    const result = editorWindow ? await dialog.showOpenDialog(editorWindow, options) : await dialog.showOpenDialog(options);
    const selected = result.filePaths[0];
    if (result.canceled || !selected) return { canceled: true };
    inspectCustomMappingArchive(selected);
    const thumbnailChoiceOptions: MessageBoxOptions = {
      type: "question",
      title: "Add a package thumbnail?",
      message: "Would you like to add a thumbnail to this listing?",
      detail: "Choose a PNG, JPEG, WebP, or GIF image up to 2 MB. You can also add or replace it later from the package menu.",
      buttons: ["Skip", "Choose image…", "Cancel upload"],
      defaultId: 1,
      cancelId: 2,
      noLink: true,
    };
    const thumbnailChoice = editorWindow ? await dialog.showMessageBox(editorWindow, thumbnailChoiceOptions) : await dialog.showMessageBox(thumbnailChoiceOptions);
    if (thumbnailChoice.response === 2) return { canceled: true };
    let thumbnailPath: string | undefined;
    if (thumbnailChoice.response === 1) {
      const thumbnailOptions: OpenDialogOptions = { title: "Choose a package thumbnail", properties: ["openFile"], filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }] };
      const thumbnail = editorWindow ? await dialog.showOpenDialog(editorWindow, thumbnailOptions) : await dialog.showOpenDialog(thumbnailOptions);
      thumbnailPath = thumbnail.filePaths[0];
      if (thumbnail.canceled || !thumbnailPath) return { canceled: true };
    }
    const release = await cloud.uploadPackage(selected);
    if (thumbnailPath) {
      const prepared = prepareThumbnail(thumbnailPath);
      try { release.thumbnailUrl = await cloud.updateThumbnail(release.releaseId, prepared.filePath); }
      finally { prepared.cleanup(); }
    }
    return { canceled: false, release };
  });
  ipcMain.handle("community:choose-thumbnail", async () => {
    const options: OpenDialogOptions = { title: "Choose a package thumbnail", properties: ["openFile"], filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }] };
    const result = editorWindow ? await dialog.showOpenDialog(editorWindow, options) : await dialog.showOpenDialog(options);
    const selected = result.filePaths[0];
    if (result.canceled || !selected) return { canceled: true };
    const prepared = prepareThumbnail(selected);
    try {
      const extension = path.extname(prepared.filePath).toLowerCase();
      const mimeTypes: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" };
      const mimeType = mimeTypes[extension];
      if (!mimeType) throw new Error("Choose a PNG, JPEG, WebP, or GIF image.");
      const data = fs.readFileSync(prepared.filePath).toString("base64");
      return { canceled: false, previewUrl: `data:${mimeType};base64,${data}`, thumbnail: { mimeType, data } };
    }
    finally { prepared.cleanup(); }
  });
  ipcMain.handle("community:update-listing", (_event, releaseId: string, listing: { name?: string; description?: string; tags: import("../src/types").CommunityPackageTag[]; removeThumbnail?: boolean; thumbnail?: { mimeType: string; data: string } }) => cloud?.updateListing(releaseId, listing));
  ipcMain.handle("community:report", (_event, releaseId: string, reason: string) => cloud?.reportRelease(releaseId, reason));
  ipcMain.handle("community:set-saved", (_event, releaseId: string, saved: boolean) => cloud?.setSaved(releaseId, saved));
  ipcMain.handle("community:download-install", async (_event, releaseId: string) => {
    if (!cloud) throw new Error("Community service is unavailable.");
    const prepared = await cloud.prepareDownload(releaseId);
    try {
      const manifest = inspectCustomMappingArchive(prepared.temporary);
      if (manifest.minimumAppVersion && versionIsOlder(app.getVersion(), manifest.minimumAppVersion)) {
        throw new Error(`${manifest.name} requires Surreality ${manifest.minimumAppVersion} or newer.`);
      }
      const permissions = manifest.permissions?.length ? manifest.permissions.join("\n• ") : "No optional capabilities";
      const nativePlugin = Boolean(manifest.entrypoints.plugin || manifest.permissions?.includes("system:unrestricted"));
      const confirmationOptions: MessageBoxOptions = {
        type: "warning", title: nativePlugin ? "Install approved native package?" : "Install community package?",
        message: `Install ${manifest.name} ${manifest.version}?`,
        detail: nativePlugin
          ? `This package contains admin-reviewed native code, but review is not a guarantee of safety. Only install it if you trust ${manifest.author?.name ?? "the publisher"}.\n\nRequested capabilities:\n• ${permissions}\n\nIts plugin process has the same operating-system access as Surreality.`
          : `This community package contains executable browser code. Only install it if you trust ${manifest.author?.name ?? "the publisher"}.\n\nRequested capabilities:\n• ${permissions}\n\nIts mapping code runs in a restricted browser sandbox.`,
        buttons: ["Cancel", "Install"], defaultId: 0, cancelId: 0, noLink: true,
      };
      const confirmation = editorWindow ? await dialog.showMessageBox(editorWindow, confirmationOptions) : await dialog.showMessageBox(confirmationOptions);
      if (confirmation.response !== 1) return { canceled: true };
      const installed = installCustomMappingArchive(app, prepared.temporary, "community");
      cloud.completeDownload(releaseId, prepared.bytes, installed.manifest);
      refreshPlugins();
      for (const window of BrowserWindow.getAllWindows()) window.webContents.send("custom-mappings:changed");
      return { canceled: false, installed };
    } finally {
      if (fs.existsSync(prepared.temporary)) fs.rmSync(prepared.temporary, { force: true });
    }
  });
  ipcMain.handle("community:moderate", (_event, releaseId: string, action: "approve" | "reject" | "take_down" | "restore", reason?: string) => cloud?.moderate(releaseId, action, reason));
  ipcMain.on("community:open", () => { for (const window of BrowserWindow.getAllWindows()) window.webContents.send("community:open"); });
  ipcMain.handle("custom-mappings:list", () => installedCustomMappings());
  ipcMain.handle("custom-mappings:import", async () => {
    const options: OpenDialogOptions = {
      title: "Import Custom Mapping",
      properties: ["openFile"],
      filters: [
        { name: "Surreality Package", extensions: ["surreality"] },
        { name: "Legacy Surreality Mapping", extensions: ["mapping"] },
      ],
    };
    const result = editorWindow
      ? await dialog.showOpenDialog(editorWindow, options)
      : await dialog.showOpenDialog(options);
    const archivePath = result.filePaths[0];
    if (result.canceled || !archivePath) return { canceled: true };
    const manifest = inspectCustomMappingArchive(archivePath);
    const permissions = manifest.permissions?.length ? manifest.permissions.join("\n• ") : "No optional capabilities";
    const nativePlugin = Boolean(manifest.entrypoints.plugin);
    const confirmationOptions: MessageBoxOptions = {
      type: "warning",
      title: nativePlugin ? "Install privileged Surreality plugin?" : "Install Surreality package?",
      message: `Install ${manifest.name} ${manifest.version}?`,
      detail: nativePlugin
        ? `This package contains native plugin code. Only install it if you trust ${manifest.author?.name ?? "its publisher"}.\n\nRequested capabilities:\n• ${permissions}\n\nIts plugin process has the same operating-system access as Surreality. It can read files, use devices, access the network, and run programs.`
        : `This package contains executable browser code. Only install it if you trust ${manifest.author?.name ?? "its publisher"}.\n\nRequested capabilities:\n• ${permissions}\n\nIts mapping code runs in a restricted browser sandbox.`,
      buttons: ["Cancel", "Install"],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    };
    const confirmation = editorWindow
      ? await dialog.showMessageBox(editorWindow, confirmationOptions)
      : await dialog.showMessageBox(confirmationOptions);
    if (confirmation.response !== 1) return { canceled: true };
    const installed = installCustomMappingArchive(app, archivePath, "local");
    localData?.archivePackage(archivePath, installed.manifest as unknown as Record<string, unknown>);
    refreshPlugins();
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send("custom-mappings:changed");
    return { canceled: false, installed };
  });
  ipcMain.handle("custom-mappings:uninstall", async (_event, packageId: string, packageVersion: string) => {
    if (packageId === "room.mapping.media") return { removed: false };
    const installed = installedCustomMappings().find(
      ({ manifest }) => manifest.id === packageId && manifest.version === packageVersion,
    );
    if (!installed) return { removed: false };
    const confirmationOptions: MessageBoxOptions = {
      type: "warning",
      title: "Uninstall custom mapping?",
      message: `Uninstall ${installed.manifest.name} ${installed.manifest.version}?`,
      detail: "Existing room objects that use this mapping will remain saved, but they cannot render until the package is reinstalled.",
      buttons: ["Cancel", "Uninstall"],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    };
    const confirmation = editorWindow
      ? await dialog.showMessageBox(editorWindow, confirmationOptions)
      : await dialog.showMessageBox(confirmationOptions);
    if (confirmation.response !== 1) return { removed: false };
    const removed = uninstallCustomMapping(app, packageId, packageVersion);
    if (removed) {
      refreshPlugins();
      for (const window of BrowserWindow.getAllWindows()) window.webContents.send("custom-mappings:changed");
    }
    return { removed };
  });

  ipcMain.on("controls-sync", (event, payload: unknown) => {
    lastControlsState = payload;
    const target = event.sender === editorWindow?.webContents ? controlsWindow : editorWindow;
    target?.webContents.send("controls-sync", payload);
  });

  ipcMain.on("sync", (_event, payload: unknown) => {
    lastPayload = payload;
    if (outputWindow && !_event.sender.isDestroyed()) {
      outputWindow.webContents.send("sync", payload);
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createEditor();
    }
  });
});

app.on("before-quit", () => {
  stopPackagePlugins();
  localData?.close();
  localData = null;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
