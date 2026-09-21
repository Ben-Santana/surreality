import { defineConfig, loadEnv } from "vite";
import { sites } from "@openai/sites-vite-plugin";
import { copyFileSync, cpSync, mkdirSync } from "node:fs";
import { basename } from "node:path";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_DOWNLOAD_");
  for (const [key, value] of Object.entries(env)) {
    if (!value.trim()) continue;
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || url.username || url.password) throw new Error();
    } catch {
      throw new Error(`${key} must be a public HTTPS download URL without credentials`);
    }
  }
  return { publicDir: command === "serve" ? "public" : false, plugins: [sites(), {
  name: "docs-entry",
  closeBundle() {
    // Local installers must never be bundled into a Vercel deployment.
    cpSync("public", "dist", { recursive: true, filter: (source) => basename(source) !== "downloads" });
    mkdirSync("dist/docs", { recursive: true });
    copyFileSync("dist/index.html", "dist/docs/index.html");
  },
}] };
});
