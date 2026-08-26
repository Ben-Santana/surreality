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
let lastPayload: unknown = null;

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
  editorWindow.on("closed", () => {
    editorWindow = null;
    outputWindow?.close();
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
