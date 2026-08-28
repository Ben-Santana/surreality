# Creating a custom mapping

Custom mappings are code-powered packages. They execute in a restricted browser iframe and communicate with Surreality through a small message-based SDK. A package cannot import the editor, its Zustand store, Electron, or Node.js modules.

## Create and package

```bash
npm run create:mapping -- neon-clock
npm run pack:mapping -- ./custom-mappings/neon-clock
```

The first command creates a manifest, mapping renderer, and inspector. The second creates a `.mapping` file that can be installed from **Add → Custom Mappings → Import .mapping…**.

A `.mapping` file is a JSON archive containing the validated manifest and base64-encoded package files. This deliberately keeps the first package format auditable and dependency-free. Published versions are immutable. Uninstalling a package does not delete mapping objects from saved rooms; reinstall the same package and version to render them again.

## Manifest

```json
{
  "manifestVersion": 1,
  "id": "com.example.neon-clock",
  "name": "Neon Clock",
  "version": "1.0.0",
  "configVersion": 1,
  "description": "A code-powered clock.",
  "author": { "name": "Example" },
  "geometry": "quad",
  "contentSize": { "width": 480, "height": 270 },
  "defaultColor": { "r": 255, "g": 255, "b": 255, "a": 255 },
  "defaultConfig": { "label": "Hello" },
  "entrypoints": {
    "mapping": "mapping.js",
    "inspector": "inspector.js",
    "runtime": "runtime.js"
  },
  "permissions": ["input:pointer", "events:room"]
}
```

Package IDs use reverse-domain style lowercase identifiers. Versions use semantic version syntax. `geometry` is `quad`, `polygon`, or `circle`.

Available permissions are:

- `audio:play`
- `events:room`
- `input:keyboard`
- `input:pointer`
- `microphone:read`
- `network:fetch`
- `storage:package`
- `files:user-selected`

Permissions are declared during installation. `network:fetch` changes the iframe Content Security Policy, `input:keyboard` receives sanitized key records, and `input:pointer` enables semantic activation events. The remaining capabilities are reserved for versioned SDK additions and are not implicitly granted as browser or Node access.

## Entrypoints

Entrypoints are standard browser ES modules. They export a mount function:

```js
export default function mount(context) {
  context.root.textContent = context.config.label;

  return () => {
    // Remove listeners or stop animation on remount.
  };
}
```

The context contains:

```ts
type MappingContext = {
  root: HTMLElement;
  mode: "mapping" | "inspector" | "runtime";
  mapping: {
    id: string;
    name: string;
    color: { r: number; g: number; b: number; a: number };
    config: Record<string, unknown>;
    packageId: string;
    packageVersion: string;
  };
  manifest: object;
  config: Record<string, unknown>;
  color: { r: number; g: number; b: number; a: number };
  assets: { url(relativePath: string): string };
  updateConfig(config: Record<string, unknown>): void;
  emit(event: MappingEvent): void;
  log(...values: unknown[]): void;
};
```

An inspector calls `updateConfig` with the complete next configuration. The editor validates that it is an object, records the change in undo history, and sends it back to every relevant frame.

An entrypoint may return either a cleanup function or an object with `destroy()`, `onEvent(event)`, and `onInput(input)` methods. It may also export top-level `onEvent` and `onInput` functions. Packages declaring `input:keyboard` receive sanitized `keydown` and `keyup` records; they never receive the host DOM event.

## Events

Mappings exchange semantic messages instead of accessing one another:

```js
context.emit({
  type: "signal",
  targetId: "optional-instance-id",
  channel: "beat",
  value: 1
});
```

Supported event types are `activate`, `hit`, and `signal`. The host always replaces an emitted event's `sourceId` with the sending mapping instance ID.

## Security and compatibility

Installed mapping code receives no Node integration and runs in an iframe with `sandbox="allow-scripts"`. Package paths, sizes, entrypoints, colors, permissions, identifiers, and versions are validated before installation. The custom protocol applies a restrictive Content Security Policy.

Installed code is still untrusted visual and behavioral content. Users see an explicit code-execution warning and requested capabilities before installation. A package should never be installed solely because its file extension looks familiar.

Spaces store the exact package ID, package version, and configuration version. If a package is unavailable, the mapping remains in the space as a placeholder and its configuration is preserved.
