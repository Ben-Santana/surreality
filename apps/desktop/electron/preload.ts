import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("room", {
  getDisplays: () => ipcRenderer.invoke("displays"),
  openOutput: (displayId?: number) => ipcRenderer.invoke("open-output", displayId),
  closeOutput: () => ipcRenderer.invoke("close-output"),
  openControls: () => ipcRenderer.invoke("open-controls"),
  closeControls: () => ipcRenderer.invoke("close-controls"),
  isControlsOpen: () => ipcRenderer.invoke("controls-open"),
  getControlsState: () => ipcRenderer.invoke("controls-state"),
  onControlsClosed: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("controls-closed", handler);
    return () => ipcRenderer.removeListener("controls-closed", handler);
  },
  syncControls: (payload: unknown) => ipcRenderer.send("controls-sync", payload),
  onControlsSync: (callback: (payload: unknown) => void) => {
    const handler = (_event: unknown, payload: unknown) => callback(payload);
    ipcRenderer.on("controls-sync", handler);
    return () => ipcRenderer.removeListener("controls-sync", handler);
  },
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
  listCustomMappings: () => ipcRenderer.invoke("custom-mappings:list"),
  importCustomMapping: () => ipcRenderer.invoke("custom-mappings:import"),
  uninstallCustomMapping: (packageId: string, packageVersion: string) =>
    ipcRenderer.invoke("custom-mappings:uninstall", packageId, packageVersion),
  onCustomMappingsChanged: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("custom-mappings:changed", handler);
    return () => ipcRenderer.removeListener("custom-mappings:changed", handler);
  },
  sync: (payload: unknown) => ipcRenderer.send("sync", payload),
  onSync: (callback: (payload: unknown) => void) => {
    const handler = (_event: unknown, payload: unknown) => callback(payload);
    ipcRenderer.on("sync", handler);
    return () => ipcRenderer.removeListener("sync", handler);
  },
});
