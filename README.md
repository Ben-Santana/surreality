# Projection Mapping Room

An Electron/React projection-mapping editor. Mappings can live freely on the stage or in the local coordinate system of a warped surface.

## Develop

```bash
npm install
npm run dev
npm run check
npm run build
```

## Add a mapping

```bash
npm run create:mapping -- ripple
```

Register the generated definition in `src/specials/registry.ts`. The registry automatically supplies creation UI, factory behavior, the inspector host, stage/projector rendering, icons, runtime hosts, overlays, and runtime synchronization.

See [docs/creating-a-mapping.md](docs/creating-a-mapping.md) for the complete contract and interaction model.
