import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import type { App } from "electron";
import type { CustomMappingPackageRecord, PluginDataMessage } from "../src/types";
import pluginHostSource from "./pluginHost.mjs?raw";

const workers = new Map<string, ChildProcess>();

function key(id: string, version: string) {
  return `${id}@${version}`;
}

export function startPackagePlugins(
  app: App,
  packages: CustomMappingPackageRecord[],
  publish: (message: PluginDataMessage) => void,
) {
  const desired = new Set<string>();
  for (const { manifest } of packages) {
    const entrypoint = manifest.entrypoints.plugin;
    if (!entrypoint || !manifest.permissions?.includes("system:unrestricted")) continue;
    const workerKey = key(manifest.id, manifest.version);
    desired.add(workerKey);
    if (workers.has(workerKey)) continue;
    const entryPath = path.join(app.getPath("userData"), "custom-mappings", manifest.id, manifest.version, entrypoint);
    const worker = spawn(process.execPath, ["--input-type=module", "--eval", pluginHostSource], {
      stdio: ["ignore", "ignore", "ignore", "ipc"],
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        SURREALITY_PLUGIN_ENTRY: entryPath,
        SURREALITY_PLUGIN_ID: manifest.id,
        SURREALITY_PLUGIN_VERSION: manifest.version,
      },
    });
    workers.set(workerKey, worker);
    worker.on("message", (raw: unknown) => {
      const message = raw as { type?: string; channel?: string; data?: unknown; message?: string };
      if (message.type === "publish" && typeof message.channel === "string") {
        publish({ packageId: manifest.id, channel: message.channel, data: message.data });
      } else if (message.type === "error") {
        console.error(`[plugin:${manifest.id}]`, message.message);
      } else if (message.type === "log") {
        console.log(`[plugin:${manifest.id}]`, message.message);
      }
    });
    worker.on("exit", () => workers.delete(workerKey));
  }
  for (const [workerKey, worker] of workers) {
    if (!desired.has(workerKey)) {
      worker.send?.({ type: "stop" });
      setTimeout(() => worker.kill(), 2_000).unref();
      workers.delete(workerKey);
    }
  }
}

export function stopPackagePlugins() {
  for (const worker of workers.values()) {
    worker.send?.({ type: "stop" });
    setTimeout(() => worker.kill(), 2_000).unref();
  }
  workers.clear();
}
