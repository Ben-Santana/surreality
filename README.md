# Projection Mapping Room

Two independent apps. Each has its own `package.json`, lockfile, and `node_modules`. Desktop is the heavier Electron editor; docs is a small static site.

```
apps/desktop   Electron + React editor (Electron, Tailwind, Zustand, Vite 7)
apps/docs      developer documentation site (React, Vite 8)
```

The repository root only forwards scripts. It has no application dependencies.

## Develop

Install each app on its own (or run `npm run bootstrap` once from the root):

```bash
npm install --prefix apps/desktop
npm install --prefix apps/docs

npm run dev:desktop
npm run dev:docs
npm run check
npm run test
npm run build:all
```

You can also `cd` into either app and use that package’s scripts directly.

## Custom mappings

The editor includes Polygon, Circle, Text, and Media as basic mappings. Dithered Media, Feynman, Sound, and Ship appear under **Custom Mappings**; third-party packages use the same package identity model and run as isolated browser code.

Create and package a mapping. These scripts run in `apps/desktop`, so generated files land in `apps/desktop/custom-mappings/`:

```bash
npm run create:mapping -- ripple
npm run pack:mapping -- ./custom-mappings/ripple
```

Import the resulting `.mapping` file from **Add → Custom Mappings → Import .mapping…**. Installed mappings can be removed with the trash button beside their name and reinstalled from the same file later.

The developer guide is `npm run dev:docs`. A concise source reference lives in [`apps/docs/creating-a-mapping.md`](apps/docs/creating-a-mapping.md).
