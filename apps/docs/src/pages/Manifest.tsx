import { CodeBlock, Pager } from "../Layout";

const example = `{
  "manifestVersion": 1,
  "id": "com.example.neon-clock",
  "name": "Neon Clock",
  "version": "1.0.0",
  "configVersion": 1,
  "description": "A code-powered clock.",
  "author": { "name": "Example", "url": "https://example.com" },
  "geometry": "quad",
  "contentSize": { "width": 480, "height": 270 },
  "defaultColor": { "r": 255, "g": 82, "b": 36, "a": 255 },
  "defaultConfig": { "label": "ROOM 02" },
  "entrypoints": {
    "mapping": "mapping.js",
    "inspector": "inspector.js"
  },
  "permissions": []
}`;

const fields = [
  ["manifestVersion", "1", "Required. Package schema. Currently must be exactly 1."],
  ["id", "string", "Required. Lowercase reverse-domain identifier matching /^[a-z0-9]+(?:[._-][a-z0-9]+)+$/."],
  ["version", "semver", "Required. Immutable release version: major.minor.patch with optional pre-release or build metadata."],
  ["name", "string", "Required. Display name, 1–80 characters after trim."],
  ["description", "string", "Required. Up to 500 characters. Shown during install."],
  ["configVersion", "integer ≥ 1", "Required. Version of the persisted configuration object. Bump it when you change the shape of defaultConfig."],
  ["author", "object", "Optional. { name: string, url?: string }. The name appears in the install warning."],
  ["minimumAppVersion", "string", "Optional. Informational minimum host version. Not enforced by Format 01."],
  ["geometry", "enum", "Required. quad, polygon, or circle. This is the surface the room warps onto a wall or object."],
  ["contentSize", "size", "Required. { width, height } with positive numbers no larger than 8192."],
  ["defaultColor", "RGBA", "Required. Channels r, g, b, a as numbers from 0 through 255."],
  ["defaultConfig", "object", "Required. Complete initial configuration. Must be a plain object, not an array."],
  ["entrypoints", "paths", "Required. mapping is required. inspector and runtime are optional relative paths."],
  ["permissions", "string[]", "Optional. Declared capabilities. Unknown strings fail validation."],
  ["thumbnail", "path", "Optional. Package-relative image path. Must pass the same path safety rules as entrypoints."],
];

export function Manifest() {
  return (
    <article className="doc-article">
      <p className="eyebrow">REFERENCE</p>
      <h1>Manifest</h1>
      <p className="lede">
        <code>manifest.json</code> is the public contract for a mapping package. The host validates identity, geometry,
        defaults, entrypoints, and permissions before any of your code runs.
      </p>

      <h2>Example</h2>
      <CodeBlock title="manifest.json" value={example} />

      <h2>Fields</h2>
      <p>Every field below is checked at install time. A failing check rejects the archive; nothing is extracted.</p>
      <div className="field-list doc-fields">
        {fields.map(([name, type, description]) => (
          <div className="field-row" key={name}><code>{name}</code><span>{type}</span><p>{description}</p></div>
        ))}
      </div>

      <h2>Identity</h2>
      <p>
        Package IDs look like <code>com.example.neon-clock</code>: at least two lowercase segments separated by
        <code>.</code>, <code>_</code>, or <code>-</code>. Versions follow semantic versioning and are immutable.
        Installing the same <code>id</code> and <code>version</code> again is a no-op; the already-installed copy is kept.
      </p>
      <p>
        Saved rooms store the exact package ID, package version, and <code>configVersion</code>. If that package is
        uninstalled, the mapping remains as a placeholder and its configuration is preserved until you reinstall the
        same identity.
      </p>

      <h2>Paths</h2>
      <p>
        Entrypoint and thumbnail paths must be non-empty, use forward slashes only, and match
        <code>A–Z a–z 0–9 . _ / -</code>. They cannot be absolute or climb out of the package with <code>..</code>.
        Each declared entrypoint must exist in the archive.
      </p>

      <h2>Geometry and size</h2>
      <p>
        <code>geometry</code> chooses the surface primitive. <code>contentSize</code> is the intrinsic pixel size of
        the mapping view before warp. The room scales and distorts that rectangle (or polygon, or circle) onto the
        physical surface; your code draws into the unwarped content box.
      </p>

      <Pager path="/manifest" />
    </article>
  );
}
