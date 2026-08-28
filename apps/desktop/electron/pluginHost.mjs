import { pathToFileURL } from "node:url";

const entryPath = process.env.SURREALITY_PLUGIN_ENTRY;
const packageId = process.env.SURREALITY_PLUGIN_ID;
const packageVersion = process.env.SURREALITY_PLUGIN_VERSION;
if (!entryPath || !packageId || !packageVersion) throw new Error("Missing plugin worker environment");
let cleanup;

function send(type, payload = {}) {
  if (process.send) process.send({ type, packageId, ...payload });
}

const context = Object.freeze({
  package: Object.freeze({ id: packageId, version: packageVersion }),
  publish(channel, data) {
    if (typeof channel !== "string" || !channel.trim()) throw new Error("publish(channel, data) requires a channel");
    send("publish", { channel, data });
  },
  log(...values) {
    send("log", { level: "log", message: values.map(String).join(" ") });
  },
});

async function stop() {
  try {
    if (typeof cleanup === "function") await cleanup();
    else if (cleanup && typeof cleanup.deactivate === "function") await cleanup.deactivate();
  } finally {
    process.exit(0);
  }
}

process.on("message", (message) => {
  if (message?.type === "stop") void stop();
});
process.on("SIGTERM", () => void stop());
process.on("SIGINT", () => void stop());

try {
  const module = await import(pathToFileURL(entryPath).href);
  const activate = module.default ?? module.activate;
  if (typeof activate !== "function") throw new Error("Plugin entrypoint must export activate(context) or a default function");
  cleanup = await activate(context);
  send("ready");
} catch (error) {
  send("error", { message: error instanceof Error ? error.stack : String(error) });
  process.exitCode = 1;
}
