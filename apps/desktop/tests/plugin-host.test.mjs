import assert from "node:assert/strict";
import { fork } from "node:child_process";
import path from "node:path";
import test from "node:test";

test("privileged plugin host activates and publishes namespaced data", async () => {
  const host = path.resolve("electron/pluginHost.mjs");
  const entry = path.resolve("tests/fixtures/plugin.mjs");
  const messages = [];
  const worker = fork(host, [], {
    stdio: ["ignore", "ignore", "ignore", "ipc"],
    env: {
      ...process.env,
      SURREALITY_PLUGIN_ENTRY: entry,
      SURREALITY_PLUGIN_ID: "com.example.device",
      SURREALITY_PLUGIN_VERSION: "1.0.0",
    },
  });
  worker.on("message", (message) => messages.push(message));
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("plugin host did not become ready")), 2_000);
    worker.on("message", (message) => {
      if (message.type !== "ready") return;
      clearTimeout(timeout);
      resolve();
    });
    worker.on("error", reject);
  });
  assert.deepEqual(messages.find((message) => message.type === "publish"), {
    type: "publish",
    packageId: "com.example.device",
    channel: "ready",
    data: { package: "com.example.device" },
  });
  worker.send({ type: "stop" });
  await new Promise((resolve) => worker.once("exit", resolve));
});
