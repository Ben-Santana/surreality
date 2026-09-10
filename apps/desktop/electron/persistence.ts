import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const STORE_NAME = "surreality";
const STORE_VERSION = 11;
const HASH = /^[a-f0-9]{64}$/;
type JsonRecord = Record<string, unknown>;
export type LocalAsset = { id: string; sha256: string; source: string; fileName: string; mimeType: string; byteSize: number };

function isRecord(value: unknown): value is JsonRecord { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function safeJson(value: string, fallback: unknown) { try { return JSON.parse(value) as unknown; } catch { return fallback; } }
function hashBuffer(buffer: Buffer) { return crypto.createHash("sha256").update(buffer).digest("hex"); }
function mimeFor(filePath: string) {
  return ({ ".avif":"image/avif", ".bmp":"image/bmp", ".gif":"image/gif", ".jpeg":"image/jpeg", ".jpg":"image/jpeg", ".mp3":"audio/mpeg", ".mp4":"video/mp4", ".ogg":"audio/ogg", ".png":"image/png", ".svg":"image/svg+xml", ".wav":"audio/wav", ".webm":"video/webm", ".webp":"image/webp" } as Record<string,string>)[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}
function extensionForMime(mimeType: string) {
  return ({ "audio/mpeg":".mp3", "audio/ogg":".ogg", "audio/wav":".wav", "image/avif":".avif", "image/bmp":".bmp", "image/gif":".gif", "image/jpeg":".jpg", "image/png":".png", "image/svg+xml":".svg", "image/webp":".webp", "video/mp4":".mp4", "video/webm":".webm" } as Record<string,string>)[mimeType] ?? "";
}

export class LocalDataStore {
  readonly databasePath: string;
  readonly assetsRoot: string;
  readonly packagesRoot: string;
  private readonly db: DatabaseSync;
  private pendingSnapshot: string | null = null;
  private snapshotTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(userDataPath: string) {
    const dataRoot = path.join(userDataPath, "data");
    this.databasePath = path.join(dataRoot, "surreality.sqlite3");
    this.assetsRoot = path.join(dataRoot, "assets");
    this.packagesRoot = path.join(dataRoot, "package-library");
    fs.mkdirSync(this.assetsRoot, { recursive: true });
    fs.mkdirSync(this.packagesRoot, { recursive: true });
    this.db = new DatabaseSync(this.databasePath);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
    this.migrate();
  }

  private migrate() {
    this.db.exec("CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY,applied_at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value_json TEXT NOT NULL,updated_at INTEGER NOT NULL)");
    const existing = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='spaces'").get();
    if (existing) {
      const columns = new Set((this.db.prepare("PRAGMA table_info(packages)").all() as { name: string }[]).map(({ name }) => name));
      if (!columns.has("source")) {
        this.db.exec(`BEGIN IMMEDIATE;
          ALTER TABLE spaces RENAME TO spaces_cloud_legacy; ALTER TABLE assets RENAME TO assets_cloud_legacy; ALTER TABLE packages RENAME TO packages_cloud_legacy;
          CREATE TABLE spaces(id TEXT PRIMARY KEY,name TEXT NOT NULL,document_json TEXT NOT NULL,schema_version INTEGER NOT NULL DEFAULT 1,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,deleted_at INTEGER);
          CREATE TABLE assets(id TEXT PRIMARY KEY,sha256 TEXT NOT NULL UNIQUE,local_path TEXT NOT NULL,file_name TEXT NOT NULL,mime_type TEXT NOT NULL,byte_size INTEGER NOT NULL,metadata_json TEXT NOT NULL DEFAULT '{}',created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
          CREATE TABLE packages(id TEXT PRIMARY KEY,package_id TEXT NOT NULL,version TEXT NOT NULL,sha256 TEXT NOT NULL,local_path TEXT NOT NULL,file_name TEXT NOT NULL,mime_type TEXT NOT NULL,byte_size INTEGER NOT NULL,manifest_json TEXT NOT NULL,source TEXT NOT NULL DEFAULT 'local' CHECK(source IN ('local','community')),community_release_id TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,UNIQUE(package_id,version,sha256));
          INSERT INTO spaces SELECT id,name,document_json,schema_version,created_at,updated_at,deleted_at FROM spaces_cloud_legacy;
          INSERT INTO assets SELECT id,sha256,local_path,file_name,mime_type,byte_size,metadata_json,created_at,updated_at FROM assets_cloud_legacy;
          INSERT INTO packages(id,package_id,version,sha256,local_path,file_name,mime_type,byte_size,manifest_json,source,created_at,updated_at) SELECT id,package_id,version,sha256,local_path,file_name,mime_type,byte_size,manifest_json,'local',created_at,updated_at FROM packages_cloud_legacy;
          DROP TABLE spaces_cloud_legacy; DROP TABLE assets_cloud_legacy; DROP TABLE packages_cloud_legacy; DROP TABLE IF EXISTS sync_queue; COMMIT;`);
      }
    } else {
      this.db.exec(`CREATE TABLE spaces(id TEXT PRIMARY KEY,name TEXT NOT NULL,document_json TEXT NOT NULL,schema_version INTEGER NOT NULL DEFAULT 1,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,deleted_at INTEGER);
        CREATE TABLE assets(id TEXT PRIMARY KEY,sha256 TEXT NOT NULL UNIQUE,local_path TEXT NOT NULL,file_name TEXT NOT NULL,mime_type TEXT NOT NULL,byte_size INTEGER NOT NULL,metadata_json TEXT NOT NULL DEFAULT '{}',created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
        CREATE TABLE packages(id TEXT PRIMARY KEY,package_id TEXT NOT NULL,version TEXT NOT NULL,sha256 TEXT NOT NULL,local_path TEXT NOT NULL,file_name TEXT NOT NULL,mime_type TEXT NOT NULL,byte_size INTEGER NOT NULL,manifest_json TEXT NOT NULL,source TEXT NOT NULL DEFAULT 'local' CHECK(source IN ('local','community')),community_release_id TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,UNIQUE(package_id,version,sha256));`);
    }
    this.db.exec("INSERT OR REPLACE INTO schema_migrations(version,applied_at) VALUES(2,unixepoch('now')*1000)");
    this.db.exec("DELETE FROM settings WHERE key LIKE 'sync-%'");
  }

  close() { this.flushSnapshot(); this.db.close(); }
  readPersistedState(name: string): string | null {
    if (name !== STORE_NAME) return null;
    const settings = Object.fromEntries((this.db.prepare("SELECT key,value_json FROM settings").all() as {key:string;value_json:string}[]).map(({key,value_json}) => [key,safeJson(value_json,null)]));
    const spaces = (this.db.prepare("SELECT id,name,document_json,updated_at FROM spaces WHERE deleted_at IS NULL ORDER BY created_at").all() as {id:string;name:string;document_json:string;updated_at:number}[]).map((row) => {
      const parsed = safeJson(row.document_json, {}); const document = isRecord(parsed) ? parsed : {};
      return { id:row.id, name:row.name, mappings:Array.isArray(document.mappings)?document.mappings:[], surfaces:Array.isArray(document.surfaces)?document.surfaces:[], updatedAt:row.updated_at };
    });
    if (!spaces.length && !Object.keys(settings).length) return null;
    return JSON.stringify({ state:{...settings,spaces}, version:STORE_VERSION });
  }
  queuePersistedState(name: string, value: string) { if (name !== STORE_NAME) return; this.pendingSnapshot=value; if (this.snapshotTimer) clearTimeout(this.snapshotTimer); this.snapshotTimer=setTimeout(() => this.flushSnapshot(),250); }
  flushSnapshot() {
    if (this.snapshotTimer) clearTimeout(this.snapshotTimer); this.snapshotTimer=null;
    const value=this.pendingSnapshot; this.pendingSnapshot=null; if (!value) return;
    const envelope=safeJson(value,null); if (!isRecord(envelope)||!isRecord(envelope.state)) return;
    const state=envelope.state; const spaces=Array.isArray(state.spaces)?state.spaces.filter(isRecord):[]; const now=Date.now();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const ids=new Set((this.db.prepare("SELECT id FROM spaces WHERE deleted_at IS NULL").all() as {id:string}[]).map(({id})=>id));
      const current=this.db.prepare("SELECT name,document_json,updated_at FROM spaces WHERE id=?");
      const upsert=this.db.prepare("INSERT INTO spaces(id,name,document_json,schema_version,created_at,updated_at,deleted_at) VALUES(?,?,?,?,?,?,NULL) ON CONFLICT(id) DO UPDATE SET name=excluded.name,document_json=excluded.document_json,updated_at=excluded.updated_at,deleted_at=NULL");
      for (const item of spaces) { const id=typeof item.id==="string"?item.id:""; if(!id)continue; ids.delete(id); const name=typeof item.name==="string"?item.name:""; const updatedAt=typeof item.updatedAt==="number"?item.updatedAt:now; const documentJson=JSON.stringify(this.materializeDataUrls({mappings:Array.isArray(item.mappings)?item.mappings:[],surfaces:Array.isArray(item.surfaces)?item.surfaces:[]})); const old=current.get(id) as {name:string;document_json:string;updated_at:number}|undefined; if(!old||old.name!==name||old.document_json!==documentJson||old.updated_at!==updatedAt) upsert.run(id,name,documentJson,1,updatedAt,updatedAt); }
      const remove=this.db.prepare("UPDATE spaces SET deleted_at=? WHERE id=?"); for(const id of ids) remove.run(now,id);
      const setting=this.db.prepare("INSERT INTO settings(key,value_json,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at"); for(const [key,item] of Object.entries(state)) if(key!=="spaces") setting.run(key,JSON.stringify(item??null),now);
      this.db.exec("COMMIT");
    } catch(error) { this.db.exec("ROLLBACK"); throw error; }
  }

  importAsset(sourcePath: string, maxBytes: number): LocalAsset { const stat=fs.statSync(sourcePath); if(!stat.isFile())throw new Error("The selected asset is not a file."); if(stat.size>maxBytes)throw new Error(`The selected file is larger than ${Math.floor(maxBytes/1024/1024)} MB.`); return this.importAssetBuffer(fs.readFileSync(sourcePath),mimeFor(sourcePath),path.basename(sourcePath),path.extname(sourcePath)); }
  private importAssetBuffer(buffer: Buffer,mimeType:string,fileName:string,preferredExtension=""):LocalAsset { const sha256=hashBuffer(buffer); const extension=preferredExtension.toLowerCase().replace(/[^.a-z0-9]/g,"")||extensionForMime(mimeType); const target=path.join(this.assetsRoot,`${sha256}${extension}`); if(!fs.existsSync(target))fs.writeFileSync(target,buffer,{flag:"wx"}); const now=Date.now(); const old=this.db.prepare("SELECT id FROM assets WHERE sha256=?").get(sha256) as {id:string}|undefined; const id=old?.id??crypto.randomUUID(); this.db.prepare("INSERT INTO assets(id,sha256,local_path,file_name,mime_type,byte_size,metadata_json,created_at,updated_at) VALUES(?,?,?,?,?,?,'{}',?,?) ON CONFLICT(sha256) DO UPDATE SET local_path=excluded.local_path,file_name=excluded.file_name,mime_type=excluded.mime_type,byte_size=excluded.byte_size,updated_at=excluded.updated_at").run(id,sha256,target,fileName,mimeType,buffer.byteLength,now,now); return {id,sha256,source:this.assetUrl(sha256),fileName,mimeType,byteSize:buffer.byteLength}; }
  private materializeDataUrls(value:unknown):unknown { if(typeof value==="string"&&value.startsWith("data:")){const match=/^data:([^;,]+)?(;base64)?,(.*)$/s.exec(value);if(!match)return value;try{const mime=match[1]||"application/octet-stream";const buffer=match[2]?Buffer.from(match[3]??"","base64"):Buffer.from(decodeURIComponent(match[3]??""),"utf8");if(!buffer.byteLength||buffer.byteLength>50*1024*1024)return value;return this.importAssetBuffer(buffer,mime,`migrated${extensionForMime(mime)}`).source;}catch{return value;}} if(Array.isArray(value))return value.map((item)=>this.materializeDataUrls(item)); if(isRecord(value))return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,this.materializeDataUrls(item)])); return value; }

  archivePackage(sourcePath:string,manifest:JsonRecord,source:"local"|"community"="local",releaseId:string|null=null){return this.archivePackageBuffer(fs.readFileSync(sourcePath),path.basename(sourcePath),manifest,source,releaseId);}
  archivePackageBuffer(buffer:Buffer,fileName:string,manifest:JsonRecord,source:"local"|"community",releaseId:string|null){const sha256=hashBuffer(buffer);const target=path.join(this.packagesRoot,`${sha256}.surreality`);if(!fs.existsSync(target))fs.writeFileSync(target,buffer,{flag:"wx"});const packageId=typeof manifest.id==="string"?manifest.id:"";const version=typeof manifest.version==="string"?manifest.version:"";if(!packageId||!version)throw new Error("Package identity is missing.");const now=Date.now();this.db.prepare("INSERT INTO packages(id,package_id,version,sha256,local_path,file_name,mime_type,byte_size,manifest_json,source,community_release_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(package_id,version,sha256) DO UPDATE SET local_path=excluded.local_path,file_name=excluded.file_name,byte_size=excluded.byte_size,manifest_json=excluded.manifest_json,source=excluded.source,community_release_id=coalesce(excluded.community_release_id,packages.community_release_id),updated_at=excluded.updated_at").run(crypto.randomUUID(),packageId,version,sha256,target,fileName,"application/vnd.surreality.package+json",buffer.byteLength,JSON.stringify(manifest),source,releaseId,now,now);return{sha256,localPath:target};}
  packageInstallSource(packageId:string,version:string):"local"|"community"|undefined {const row=this.db.prepare("SELECT source FROM packages WHERE package_id=? AND version=? ORDER BY updated_at DESC LIMIT 1").get(packageId,version) as {source:string}|undefined;return row?.source==="community"?"community":row?.source==="local"?"local":undefined;}
  hasPackageHash(sha256:string){if(!HASH.test(sha256))return false;const row=this.db.prepare("SELECT local_path FROM packages WHERE sha256=?").get(sha256) as {local_path:string}|undefined;return Boolean(row&&fs.existsSync(row.local_path));}
  assetUrl(sha256:string){if(!HASH.test(sha256))throw new Error("Invalid asset hash.");return `surreality-asset://local/${sha256}`;}
  assetByHash(sha256:string){if(!HASH.test(sha256))return null;return(this.db.prepare("SELECT local_path,mime_type,byte_size FROM assets WHERE sha256=?").get(sha256) as {local_path:string;mime_type:string;byte_size:number}|undefined)??null;}
}
