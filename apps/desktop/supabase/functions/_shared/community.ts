import { createClient, type User } from "npm:@supabase/supabase-js@2";

export const MAX_ARCHIVE_BYTES = 50 * 1024 * 1024;
export const MAX_FILES = 512;
const PACKAGE_ID = /^[a-z0-9]+(?:[._-][a-z0-9]+)+$/;
const VERSION = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const PERMISSIONS = new Set([
  "audio:play", "camera:read", "events:room", "input:keyboard", "input:pointer",
  "microphone:read", "network:fetch", "storage:package", "files:user-selected",
  "device:usb", "device:serial", "device:camera", "device:midi", "network:listen",
  "process:spawn", "background:run", "events:publish", "system:unrestricted",
]);

type JsonRecord = Record<string, unknown>;
type ArchiveFile = { encoding: "utf8" | "base64"; content: string };

export const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

export function errorResponse(error: unknown, fallbackStatus = 400) {
  const message = error instanceof Error ? error.message : String(error);
  const status = /authentication required/i.test(message) ? 401
    : /not permitted|forbidden/i.test(message) ? 403
      : /not found/i.test(message) ? 404
        : /rate limit/i.test(message) ? 429
          : fallbackStatus;
  return json({ error: message }, status);
}

export function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase function environment is incomplete");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function optionalUser(request: Request): Promise<User | null> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await serviceClient().auth.getUser(token);
  if (error) return null;
  return data.user;
}

export async function requiredUser(request: Request) {
  const user = await optionalUser(request);
  if (!user) throw new Error("Authentication required");
  return user;
}

export async function isAdmin(userId: string) {
  const { data, error } = await serviceClient().from("app_admins").select("user_id").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function enforceRateLimit(bucket: string, subject: string, maximum: number) {
  const client = serviceClient();
  await client.from("community_rate_limits").delete().lt("window_started_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString());
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(subject));
  const subjectHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const date = new Date();
  date.setUTCMinutes(0, 0, 0);
  const windowStartedAt = date.toISOString();
  const existing = await client.from("community_rate_limits").select("request_count")
    .eq("bucket", bucket).eq("subject_hash", subjectHash).eq("window_started_at", windowStartedAt).maybeSingle();
  if (existing.error) throw existing.error;
  if (Number(existing.data?.request_count ?? 0) >= maximum) throw new Error("Rate limit exceeded. Try again later.");
  const result = await client.from("community_rate_limits").upsert({
    bucket,
    subject_hash: subjectHash,
    window_started_at: windowStartedAt,
    request_count: Number(existing.data?.request_count ?? 0) + 1,
  }, { onConflict: "bucket,subject_hash,window_started_at" });
  if (result.error) throw result.error;
}

function record(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safePath(value: unknown) {
  if (typeof value !== "string" || !value || value.includes("\\") || !/^[A-Za-z0-9._/-]+$/.test(value)) {
    throw new Error("Package paths must be non-empty forward-slash paths");
  }
  const segments = value.split("/");
  if (value.startsWith("/") || segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error(`Unsafe package path: ${value}`);
  }
  return value;
}

function decodedSize(file: ArchiveFile) {
  if (file.encoding === "utf8") return new TextEncoder().encode(file.content).byteLength;
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(file.content) || file.content.length % 4 !== 0) {
    throw new Error("Invalid base64 package file");
  }
  const padding = file.content.endsWith("==") ? 2 : file.content.endsWith("=") ? 1 : 0;
  return (file.content.length / 4) * 3 - padding;
}

export function validateArchive(raw: unknown) {
  if (!record(raw) || !record(raw.manifest) || !record(raw.files)) throw new Error("Invalid Surreality archive");
  const value = raw.manifest;
  if (value.manifestVersion !== 1 && value.manifestVersion !== 2) throw new Error("Unsupported manifestVersion");
  if (typeof value.id !== "string" || !PACKAGE_ID.test(value.id)) throw new Error("Invalid package id");
  if (typeof value.version !== "string" || !VERSION.test(value.version)) throw new Error("Invalid package version");
  if (value.minimumAppVersion != null && (typeof value.minimumAppVersion !== "string" || !VERSION.test(value.minimumAppVersion))) throw new Error("Invalid minimumAppVersion");
  if (typeof value.name !== "string" || !value.name.trim() || value.name.length > 80) throw new Error("Invalid package name");
  if (typeof value.description !== "string" || value.description.length > 500) throw new Error("Invalid package description");
  if (typeof value.configVersion !== "number" || !Number.isInteger(value.configVersion) || value.configVersion < 1) throw new Error("Invalid configVersion");
  const defaultColor = value.defaultColor;
  if (!record(defaultColor) || !["r", "g", "b", "a"].every((key) => typeof defaultColor[key] === "number" && Number(defaultColor[key]) >= 0 && Number(defaultColor[key]) <= 255)) throw new Error("Invalid defaultColor");
  if (!record(value.defaultConfig)) throw new Error("Invalid defaultConfig");
  const contentSize = value.contentSize;
  if (!record(contentSize) || !["width", "height"].every((key) => typeof contentSize[key] === "number" && Number(contentSize[key]) > 0 && Number(contentSize[key]) <= 8192)) throw new Error("Invalid contentSize");
  if (!["quad", "polygon", "circle"].includes(String(value.geometry))) throw new Error("Invalid geometry");
  if (!record(value.entrypoints)) throw new Error("Invalid entrypoints");
  const entrypoints = Object.fromEntries(Object.entries(value.entrypoints).filter(([, item]) => item != null).map(([key, item]) => [key, safePath(item)]));
  if (typeof entrypoints.mapping !== "string") throw new Error("A mapping entrypoint is required");
  if (Object.keys(entrypoints).some((key) => !["mapping", "inspector", "runtime", "plugin"].includes(key))) throw new Error("Unknown entrypoint");
  const permissions = value.permissions == null ? [] : value.permissions;
  if (!Array.isArray(permissions) || !permissions.every((permission) => typeof permission === "string" && PERMISSIONS.has(permission))) throw new Error("Manifest contains an unknown permission");
  if (entrypoints.plugin && value.manifestVersion !== 2) throw new Error("Plugin entrypoints require manifestVersion 2");
  if (entrypoints.plugin && !permissions.includes("system:unrestricted")) throw new Error("Native plugins require system:unrestricted");
  const files = Object.entries(raw.files);
  if (files.length < 1 || files.length > MAX_FILES) throw new Error(`Packages must contain between 1 and ${MAX_FILES} files`);
  const paths = new Set<string>();
  let expandedBytes = 0;
  for (const [filePath, rawFile] of files) {
    const normalized = safePath(filePath);
    if (paths.has(normalized)) throw new Error(`Duplicate package path: ${normalized}`);
    paths.add(normalized);
    const file = typeof rawFile === "string" ? { encoding: "utf8", content: rawFile } : rawFile;
    if (!record(file) || (file.encoding !== "utf8" && file.encoding !== "base64") || typeof file.content !== "string") throw new Error(`Invalid file record for ${normalized}`);
    expandedBytes += decodedSize(file as ArchiveFile);
    if (expandedBytes > MAX_ARCHIVE_BYTES) throw new Error("Expanded package is larger than 50 MB");
  }
  for (const entrypoint of Object.values(entrypoints)) if (!paths.has(entrypoint)) throw new Error(`Missing entrypoint: ${entrypoint}`);
  if (typeof value.thumbnail === "string" && !paths.has(safePath(value.thumbnail))) throw new Error("Missing thumbnail");
  const manifest = { ...value, id: value.id, version: value.version, name: value.name.trim(), entrypoints, permissions } as JsonRecord & { id: string; version: string; name: string };
  return {
    manifest,
    native: Boolean(entrypoints.plugin || permissions.includes("system:unrestricted")),
  };
}

export async function sha256(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
