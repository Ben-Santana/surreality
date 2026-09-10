# Surreality

Two independent apps. Each has its own `package.json`, lockfile, and `node_modules`. Desktop is the heavier Electron editor; docs is a small static site.

```
apps/desktop   Electron + React editor (Electron, Tailwind, Zustand, Vite 7)
apps/docs      developer documentation site (React, Vite 8)
```

The repository root only forwards scripts. It has no application dependencies.

Rooms and media stay local in SQLite. The optional Supabase-backed community library provides accounts, public `.surreality` listings, private archive storage, download history, and moderation. Setup is documented in [`SUPABASE_SETUP.md`](SUPABASE_SETUP.md).

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

The editor includes Polygon, Circle, Text, and Media as basic mappings. Third-party `.surreality` packages can contain isolated browser mappings and, after a high-risk permission prompt, an optional privileged native plugin worker for devices and operating-system integrations.

Create and package a mapping. These scripts run in `apps/desktop`, so generated files land in `apps/desktop/custom-mappings/`:

```bash
npm run create:mapping -- ripple
npm run pack:mapping -- ./custom-mappings/ripple
```

Import the resulting `.surreality` file from **Add → Custom Mappings → Import .surreality…**. Legacy `.mapping` files remain supported. Installed packages can be removed with the trash button beside their name and reinstalled later.

The developer guide is `npm run dev:docs`. A concise source reference lives in [`apps/docs/creating-a-mapping.md`](apps/docs/creating-a-mapping.md).
