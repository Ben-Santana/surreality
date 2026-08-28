# Projection Mapping Room

An Electron/React projection-mapping editor. Mappings can live freely on the stage or in the local coordinate system of a warped surface.

## Develop

```bash
npm install
npm run dev
npm run check
npm run build
```

## Custom mappings

The editor includes Polygon, Circle, and Text as basic mappings. Everything else appears under **Custom Mappings**. The current Media, Dithered Media, Feynman, Sound, and Ship mappings are bundled custom mappings; third-party packages use the same package identity model and run as isolated browser code.

Create and package a mapping:

```bash
npm run create:mapping -- ripple
npm run pack:mapping -- ./custom-mappings/ripple
```

Import the resulting `.roommapping` file from **Add → Custom Mappings → Import package…**.

See [docs/creating-a-mapping.md](docs/creating-a-mapping.md) for the package manifest, sandbox, SDK context, permissions, and event contract.
