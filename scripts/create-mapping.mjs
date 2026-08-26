import fs from "node:fs";
import path from "node:path";

const raw = process.argv[2] ?? "";
const kind = raw.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
if (!kind) {
  console.error("Usage: npm run create:mapping -- my-mapping");
  process.exitCode = 1;
} else {
  const pascal = kind.split("-").map((part) => part[0]?.toUpperCase() + part.slice(1)).join("");
  const directory = path.resolve("src/specials", kind);
  if (fs.existsSync(directory)) {
    console.error(`Mapping already exists: ${directory}`);
    process.exitCode = 1;
  } else {
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, "config.ts"), `export type ${pascal}Config = { label: string };\n\nexport const default${pascal}Config: ${pascal}Config = { label: "${pascal}" };\n`);
    fs.writeFileSync(path.join(directory, `${pascal}View.tsx`), `import type { SpecialViewProps } from "../types";\nimport type { ${pascal}Config } from "./config";\n\nexport function ${pascal}View({ config }: SpecialViewProps<${pascal}Config>) {\n  return <div className="flex h-full w-full items-center justify-center">{config.label}</div>;\n}\n`);
    fs.writeFileSync(path.join(directory, "definition.ts"), `import type { SpecialDefinition } from "../types";\nimport { default${pascal}Config, type ${pascal}Config } from "./config";\nimport { ${pascal}View } from "./${pascal}View";\n\nexport const ${kind.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())}Special: SpecialDefinition<${pascal}Config> = {\n  kind: "${kind}",\n  version: 1,\n  label: "${pascal}",\n  description: "Describe this mapping.",\n  contentSize: { width: 240, height: 180 },\n  defaultColor: { r: 255, g: 255, b: 255, a: 255 },\n  defaultConfig: default${pascal}Config,\n  View: ${pascal}View,\n};\n`);
    console.log(`Created ${path.relative(process.cwd(), directory)}. Import and register its definition in src/specials/registry.ts.`);
  }
}
