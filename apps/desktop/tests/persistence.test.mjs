import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { LocalDataStore } from "../electron/persistence.ts";

function withStore(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "surreality-persistence-"));
  const store = new LocalDataStore(root);
  try {
    return run(store, root);
  } finally {
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("persists spaces and settings in SQLite", () => {
  withStore((store) => {
    const envelope = JSON.stringify({
      version: 11,
      state: {
        showGrid: false,
        gridSize: "large",
        spaces: [{
          id: "398baf14-b245-4a54-9e72-a29c11a40662",
          name: "Studio",
          mappings: [],
          surfaces: [],
          updatedAt: 1_700_000_000_000,
        }],
      },
    });
    store.queuePersistedState("surreality", envelope);
    store.flushSnapshot();
    const restored = JSON.parse(store.readPersistedState("surreality"));
    assert.equal(restored.state.showGrid, false);
    assert.equal(restored.state.gridSize, "large");
    assert.equal(restored.state.spaces[0].name, "Studio");
  });
});

test("moves legacy data URLs into the content-addressed asset store", () => {
  withStore((store) => {
    const envelope = JSON.stringify({
      version: 11,
      state: {
        spaces: [{
          id: "9bb6ba61-8ffd-4f38-a77e-eec4cf49d763",
          name: "Legacy",
          mappings: [{
            id: "mapping-1",
            type: "custom",
            config: { source: "data:image/png;base64,aGVsbG8=" },
          }],
          surfaces: [],
          updatedAt: 1_700_000_000_001,
        }],
      },
    });
    store.queuePersistedState("surreality", envelope);
    store.flushSnapshot();
    const restored = JSON.parse(store.readPersistedState("surreality"));
    const source = restored.state.spaces[0].mappings[0].config.source;
    assert.match(source, /^surreality-asset:\/\/local\/[a-f0-9]{64}$/);
    assert.equal(fs.readdirSync(store.assetsRoot).length, 1);
  });
});

test("deduplicates imported files by SHA-256", () => {
  withStore((store, root) => {
    const firstPath = path.join(root, "first.png");
    const secondPath = path.join(root, "second.png");
    fs.writeFileSync(firstPath, "same bytes");
    fs.writeFileSync(secondPath, "same bytes");
    const first = store.importAsset(firstPath, 1_000);
    const second = store.importAsset(secondPath, 1_000);
    assert.equal(first.id, second.id);
    assert.equal(first.sha256, second.sha256);
    assert.equal(fs.readdirSync(store.assetsRoot).length, 1);
  });
});

test("archives local packages without scheduling a cloud upload", () => {
  withStore((store, root) => {
    const packagePath = path.join(root, "example.surreality");
    fs.writeFileSync(packagePath, JSON.stringify({ manifest: { id: "example.mapping", version: "1.0.0" }, files: {} }));
    const archived = store.archivePackage(packagePath, { id: "example.mapping", version: "1.0.0" });
    assert.match(archived.sha256, /^[a-f0-9]{64}$/);
    assert.equal(fs.existsSync(archived.localPath), true);
    assert.equal(fs.readdirSync(store.packagesRoot).length, 1);
  });
});

test("migrates legacy cloud-shaped SQLite rows to local-only tables", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "surreality-legacy-db-"));
  const data = path.join(root, "data");
  fs.mkdirSync(data, { recursive: true });
  const databasePath = path.join(data, "surreality.sqlite3");
  const db = new DatabaseSync(databasePath);
  db.exec(`
    CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL);
    CREATE TABLE settings(key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE spaces(id TEXT PRIMARY KEY,name TEXT NOT NULL,document_json TEXT NOT NULL,schema_version INTEGER NOT NULL,local_revision INTEGER NOT NULL,remote_revision INTEGER NOT NULL,sync_status TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,deleted_at INTEGER);
    CREATE TABLE assets(id TEXT PRIMARY KEY,sha256 TEXT NOT NULL UNIQUE,local_path TEXT NOT NULL,remote_path TEXT,file_name TEXT NOT NULL,mime_type TEXT NOT NULL,byte_size INTEGER NOT NULL,metadata_json TEXT NOT NULL,sync_status TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
    CREATE TABLE packages(id TEXT PRIMARY KEY,package_id TEXT NOT NULL,version TEXT NOT NULL,sha256 TEXT NOT NULL,local_path TEXT NOT NULL,remote_path TEXT,file_name TEXT NOT NULL,mime_type TEXT NOT NULL,byte_size INTEGER NOT NULL,manifest_json TEXT NOT NULL,sync_status TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,UNIQUE(package_id,version,sha256));
    CREATE TABLE sync_queue(id INTEGER PRIMARY KEY,entity_type TEXT,entity_id TEXT,operation TEXT,attempts INTEGER,next_attempt_at INTEGER,last_error TEXT,created_at INTEGER,updated_at INTEGER);
    INSERT INTO spaces VALUES('legacy','Legacy','{"mappings":[],"surfaces":[]}',1,2,1,'synced',10,20,NULL);
  `);
  db.close();
  const store = new LocalDataStore(root);
  try {
    const restored = JSON.parse(store.readPersistedState("surreality"));
    assert.equal(restored.state.spaces[0].name, "Legacy");
  } finally {
    store.close();
    const migrated = new DatabaseSync(databasePath, { readOnly: true });
    const columns = migrated.prepare("PRAGMA table_info(spaces)").all().map((column) => column.name);
    assert.equal(columns.includes("remote_revision"), false);
    assert.equal(migrated.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sync_queue'").get(), undefined);
    migrated.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
