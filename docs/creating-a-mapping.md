# Creating a mapping

Each extensible mapping is one folder containing a definition and its private implementation. Core application components must not import an individual mapping.

## Definition

Run `npm run create:mapping -- name`, then register the generated definition once in `src/specials/registry.ts`.

A definition owns:

- catalogue metadata and icon;
- versioned, typed configuration;
- default geometry and appearance;
- its stage/projector `View` and optional `Inspector`;
- optional interaction handlers;
- optional editor runtime, overlay, and projector snapshot adapter.

Use `parseConfig` for all untrusted persisted data. Increment `version` when stored config changes and implement `migrateConfig`. Old or missing properties must always produce a valid current config.

## Interactions

Mappings communicate through `emitSpecialEvent` from `src/specials/events.ts`. Do not import another mapping's player, store, or runtime.

Supported semantic events are:

- `activate`: a click-equivalent action;
- `hit`: a spatial impact, with source, target, and point;
- `signal`: an extensible named value channel.

Handle them with `onEvent` in the definition. Events may target one mapping or broadcast. Consumers should ignore channels and event types they do not support. Spatial producers should target mappings on the same surface unless their feature explicitly operates room-wide.

## Runtime behavior

Use `runtime.Host` for input listeners or animation loops and `runtime.Overlay` for transient visual effects. If the effect must appear in the projector window, expose `subscribe`, `getSnapshot`, and `applySnapshot`. Runtime snapshots are ephemeral: never put bullets, particles, hover state, or audio triggers in persisted mapping config.

All persistent mutations should go through `useRoomStore` actions so undo and saved spaces remain coherent. A runtime may read the store directly for frame-critical queries, but should avoid feature-specific changes to `App`, `Editor`, `Stage`, or `OutputView`.

## Completion checklist

- Config has a version and validation/migration strategy.
- No shared component imports the new mapping.
- Geometry is one of `quad`, `polygon`, or `circle`.
- Interaction uses semantic events.
- Ephemeral state uses the runtime snapshot adapter.
- The mapping works in both editor and projector output.
- `npm run check` and `npm run build` pass.
