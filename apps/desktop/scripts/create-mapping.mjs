import fs from "node:fs";
import path from "node:path";

const raw = process.argv[2] ?? "";
const slug = raw.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
if (!slug) {
  console.error("Usage: npm run create:mapping -- my-mapping");
  process.exitCode = 1;
} else {
  const title = slug.split("-").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");
  const directory = path.resolve("custom-mappings", slug);
  if (fs.existsSync(directory)) {
    console.error(`Mapping already exists: ${directory}`);
    process.exitCode = 1;
  } else {
    fs.mkdirSync(directory, { recursive: true });
    const manifest = {
      manifestVersion: 1,
      id: `local.${slug}`,
      name: title,
      version: "1.0.0",
      configVersion: 1,
      description: "Describe this custom mapping.",
      author: { name: "Local creator" },
      geometry: "quad",
      contentSize: { width: 480, height: 270 },
      defaultColor: { r: 255, g: 255, b: 255, a: 255 },
      defaultConfig: { label: title },
      entrypoints: { mapping: "mapping.js", inspector: "inspector.js" },
      permissions: [],
    };
    fs.writeFileSync(path.join(directory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    fs.writeFileSync(path.join(directory, "mapping.js"), `export default function mount({ root, config, color }) {
  root.style.display = "grid";
  root.style.placeItems = "center";
  root.style.background = \`rgba(\${color.r}, \${color.g}, \${color.b}, \${color.a / 255})\`;
  root.style.color = "white";
  root.style.font = "600 28px system-ui, sans-serif";
  root.textContent = config.label ?? "${title}";
}
`);
    fs.writeFileSync(path.join(directory, "inspector.js"), `export default function mount({ root, config, updateConfig }) {
  root.style.padding = "12px";
  root.style.color = "white";
  root.style.font = "13px system-ui, sans-serif";
  const label = document.createElement("label");
  label.textContent = "Label";
  const input = document.createElement("input");
  input.value = config.label ?? "";
  input.style.cssText = "display:block;width:100%;margin-top:8px;padding:8px;background:#18181b;color:white;border:1px solid #3f3f46";
  input.addEventListener("input", () => updateConfig({ ...config, label: input.value }));
  label.append(input);
  root.append(label);
}
`);
    console.log(`Created ${path.relative(process.cwd(), directory)}. Run npm run pack:mapping -- ${path.relative(process.cwd(), directory)} when it is ready.`);
  }
}
