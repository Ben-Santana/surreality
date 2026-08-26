import { createRequire } from "node:module";

const { contextBridge, ipcRenderer } = createRequire(import.meta.url)(
  "electron",
) as typeof import("electron");

contextBridge.exposeInMainWorld("room", {
  getDisplays: () => ipcRenderer.invoke("displays"),
  openOutput: (displayId?: number) => ipcRenderer.invoke("open-output", displayId),
  closeOutput: () => ipcRenderer.invoke("close-output"),
  onOutputClosed: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("output-closed", handler);
    return () => ipcRenderer.removeListener("output-closed", handler);
  },
  onUndo: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("history-undo", handler);
    return () => ipcRenderer.removeListener("history-undo", handler);
  },
  onRedo: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("history-redo", handler);
    return () => ipcRenderer.removeListener("history-redo", handler);
  },
  sync: (payload: unknown) => ipcRenderer.send("sync", payload),
  onSync: (callback: (payload: unknown) => void) => {
    const handler = (_event: unknown, payload: unknown) => callback(payload);
    ipcRenderer.on("sync", handler);
    return () => ipcRenderer.removeListener("sync", handler);
  },
});
