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
        // Our windows use sandbox:false with context isolation. Electron only
        // supports ESM imports (not require) in that preload configuration.
        vite: {
          build: {
            rollupOptions: {
              output: {
                format: "es",
                entryFileNames: "preload.mjs",
                inlineDynamicImports: true,
              },
            },
          },
        },
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.join(root, "src"),
    },
  },
});
