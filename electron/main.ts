import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { BrowserWindow as ElectronWindow } from "electron";

const { app, BrowserWindow, ipcMain, Menu, screen } = createRequire(import.meta.url)(
  "electron",
) as typeof import("electron");

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const RENDERER_DIST = path.join(__dirname, "../dist");

let editorWindow: ElectronWindow | null = null;
let outputWindow: ElectronWindow | null = null;
let controlsWindow: ElectronWindow | null = null;
let lastPayload: unknown = null;
let lastControlsState: unknown = null;

function preloadPath() {
  const mjs = path.join(__dirname, "preload.mjs");
  const js = path.join(__dirname, "preload.js");
  return fs.existsSync(mjs) ? mjs : js;
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
  app.setName("Projection Mapping Room");
  installMenu();
  createEditor();

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

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
