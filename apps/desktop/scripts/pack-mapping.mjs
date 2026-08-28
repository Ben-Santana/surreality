import fs from "node:fs";
import path from "node:path";

const directory = path.resolve(process.argv[2] ?? "");
if (!process.argv[2] || !fs.existsSync(directory)) {
  console.error("Usage: npm run pack:mapping -- ./custom-mappings/my-mapping [output.surreality]");
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(path.join(directory, "manifest.json"), "utf8"));
if (![1, 2].includes(manifest.manifestVersion) || typeof manifest.id !== "string" || typeof manifest.version !== "string") {
  throw new Error("manifest.json is not a supported Surreality package manifest");
}

const files = {};
function collect(current) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const absolute = path.join(current, entry.name);
    const relative = path.relative(directory, absolute).split(path.sep).join("/");
    if (entry.name === "manifest.json" || entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) collect(absolute);
    else if (entry.isFile() && !entry.name.endsWith(".mapping") && !entry.name.endsWith(".surreality")) {
      files[relative] = { encoding: "base64", content: fs.readFileSync(absolute).toString("base64") };
    }
  }
}
collect(directory);

for (const entrypoint of Object.values(manifest.entrypoints ?? {})) {
  if (entrypoint && !files[entrypoint]) throw new Error(`Missing entrypoint: ${entrypoint}`);
}

const output = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.join(directory, `${manifest.id}-${manifest.version}.surreality`);
fs.writeFileSync(output, `${JSON.stringify({ manifest, files })}\n`, { flag: "w" });
console.log(`Packed ${path.relative(process.cwd(), output)}`);
