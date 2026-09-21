import { defineConfig } from "vite";
import { sites } from "@openai/sites-vite-plugin";
import { copyFileSync, mkdirSync } from "node:fs";

export default defineConfig({ plugins: [sites(), {
  name: "docs-entry",
  closeBundle() {
    mkdirSync("dist/docs", { recursive: true });
    copyFileSync("dist/index.html", "dist/docs/index.html");
  },
}] });
