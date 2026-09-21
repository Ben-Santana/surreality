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
  startup: {
    getSettings: () => ipcRenderer.invoke("startup:get-settings"),
    shouldRun: () => ipcRenderer.invoke("startup:should-run"),
    setSettings: (settings: unknown) => ipcRenderer.invoke("startup:set-settings", settings),
    ready: (payload: unknown) => ipcRenderer.invoke("startup:ready", payload),
    cancel: (message?: string) => ipcRenderer.invoke("startup:cancel", message),
    onDisplaysChanged: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on("displays-changed", handler);
      return () => ipcRenderer.removeListener("displays-changed", handler);
    },
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
  persistence: {
    getItem: (name: string) => ipcRenderer.invoke("persistence:get", name),
    setItem: (name: string, value: string) => ipcRenderer.send("persistence:put", name, value),
    flush: () => ipcRenderer.invoke("persistence:flush"),
  },
  importAsset: (kind: "media" | "audio") => ipcRenderer.invoke("assets:import", kind),
  cloud: {
    configure: (url: string, publishableKey: string) => ipcRenderer.invoke("cloud:configure", url, publishableKey),
    getState: () => ipcRenderer.invoke("cloud:state"),
    signUp: (email: string, password: string) => ipcRenderer.invoke("cloud:sign-up", email, password),
    signIn: (email: string, password: string) => ipcRenderer.invoke("cloud:sign-in", email, password),
    signOut: () => ipcRenderer.invoke("cloud:sign-out"),
    sendPasswordReset: (email: string) => ipcRenderer.invoke("cloud:password-reset", email),
    recoverPassword: (email: string, token: string, newPassword: string) => ipcRenderer.invoke("cloud:password-recover", email, token, newPassword),
    onState: (callback: (state: unknown) => void) => {
      const handler = (_event: unknown, state: unknown) => callback(state);
      ipcRenderer.on("cloud:state", handler);
      return () => ipcRenderer.removeListener("cloud:state", handler);
    },
  },
  community: {
    browse: (options: unknown) => ipcRenderer.invoke("community:browse", options),
    getPackage: (packageId: string) => ipcRenderer.invoke("community:get-package", packageId),
    listDownloads: () => ipcRenderer.invoke("community:list-downloads"),
    listSaved: () => ipcRenderer.invoke("community:list-saved"),
    listUploads: () => ipcRenderer.invoke("community:list-uploads"),
    listModerationQueue: () => ipcRenderer.invoke("community:list-moderation"),
    setUsername: (username: string) => ipcRenderer.invoke("community:set-username", username),
    uploadFromFile: () => ipcRenderer.invoke("community:upload"),
    chooseThumbnail: () => ipcRenderer.invoke("community:choose-thumbnail"),
    updateListing: (releaseId: string, listing: unknown) => ipcRenderer.invoke("community:update-listing", releaseId, listing),
    downloadAndInstall: (releaseId: string) => ipcRenderer.invoke("community:download-install", releaseId),
    report: (releaseId: string, reason: string) => ipcRenderer.invoke("community:report", releaseId, reason),
    setSaved: (releaseId: string, saved: boolean) => ipcRenderer.invoke("community:set-saved", releaseId, saved),
    takeDown: (releaseId: string, reason?: string) => ipcRenderer.invoke("community:moderate", releaseId, "take_down", reason),
    restore: (releaseId: string) => ipcRenderer.invoke("community:moderate", releaseId, "restore"),
    approve: (releaseId: string) => ipcRenderer.invoke("community:moderate", releaseId, "approve"),
    reject: (releaseId: string, reason: string) => ipcRenderer.invoke("community:moderate", releaseId, "reject", reason),
    onProgress: (callback: (progress: unknown) => void) => {
      const handler = (_event: unknown, progress: unknown) => callback(progress);
      ipcRenderer.on("community:progress", handler);
      return () => ipcRenderer.removeListener("community:progress", handler);
    },
    open: () => ipcRenderer.send("community:open"),
    onOpen: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on("community:open", handler);
      return () => ipcRenderer.removeListener("community:open", handler);
    },
  },
  onPluginData: (callback: (payload: unknown) => void) => {
    const handler = (_event: unknown, payload: unknown) => callback(payload);
    ipcRenderer.on("plugin:data", handler);
    return () => ipcRenderer.removeListener("plugin:data", handler);
  },
  sync: (payload: unknown) => ipcRenderer.send("sync", payload),
  getSync: () => ipcRenderer.invoke("sync:get"),
  onSync: (callback: (payload: unknown) => void) => {
    const handler = (_event: unknown, payload: unknown) => callback(payload);
    ipcRenderer.on("sync", handler);
    return () => ipcRenderer.removeListener("sync", handler);
  },
});
