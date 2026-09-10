import { corsHeaders, errorResponse, json, requiredUser, serviceClient } from "../_shared/community.ts";

const MIME_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await requiredUser(request);
    const body = await request.json() as { releaseId?: string; mimeType?: string; data?: string };
    const releaseId = body.releaseId?.trim() ?? "";
    const mimeType = body.mimeType ?? "";
    const extension = MIME_EXTENSIONS[mimeType];
    if (!releaseId || !extension || typeof body.data !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(body.data)) throw new Error("A valid thumbnail is required");
    const bytes = Uint8Array.from(atob(body.data), (character) => character.charCodeAt(0));
    if (bytes.byteLength < 1 || bytes.byteLength > 2 * 1024 * 1024) throw new Error("Thumbnail must be smaller than 2 MB");
    const client = serviceClient();
    const release = await client.from("package_releases").select("id,owner_id,thumbnail_path").eq("id", releaseId).maybeSingle();
    if (release.error) throw release.error;
    if (!release.data) throw new Error("Release not found");
    if (release.data.owner_id !== user.id) throw new Error("Action not permitted");
    const thumbnailPath = `${releaseId}/${crypto.randomUUID()}.${extension}`;
    const upload = await client.storage.from("package-thumbnails").upload(thumbnailPath, bytes, { contentType: mimeType, upsert: false });
    if (upload.error) throw upload.error;
    const update = await client.from("package_releases").update({ thumbnail_path: thumbnailPath }).eq("id", releaseId);
    if (update.error) {
      await client.storage.from("package-thumbnails").remove([thumbnailPath]);
      throw update.error;
    }
    if (release.data.thumbnail_path) await client.storage.from("package-thumbnails").remove([release.data.thumbnail_path]);
    return json({ thumbnailPath });
  } catch (error) {
    return errorResponse(error);
  }
});

