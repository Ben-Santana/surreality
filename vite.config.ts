import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import electron from "vite-plugin-electron/simple";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

function startElectron({
  startup,
}: {
  startup: (argv?: string[], options?: import("node:child_process").SpawnOptions) => Promise<void>;
}) {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  void startup([".", "--no-sandbox"], { env });
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    electron({
      main: {
        entry: "electron/main.ts",
        onstart: startElectron,
      },
      preload: {
        input: path.join(root, "electron/preload.ts"),
        onstart: startElectron,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.join(root, "src"),
    },
  },
});
