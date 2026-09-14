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
    const body = await request.json() as { releaseId?: string; name?: string; description?: string; tags?: unknown; removeThumbnail?: boolean; thumbnail?: { mimeType?: string; data?: string } };
    const releaseId = body.releaseId?.trim() ?? "";
    const name = body.name?.trim() ?? "";
    const description = body.description?.trim() ?? "";
    if (!releaseId) throw new Error("Release id is required");
    if (!name || name.length > 80) throw new Error("Listing name must be between 1 and 80 characters");
    if (description.length > 500) throw new Error("Description must be 500 characters or fewer");
    const allowedTags = new Set(["media", "games", "audio", "visuals", "tools"]);
    if (!Array.isArray(body.tags) || body.tags.length < 1 || body.tags.length > 3 || !body.tags.every((tag) => typeof tag === "string" && allowedTags.has(tag)) || new Set(body.tags).size !== body.tags.length) throw new Error("Choose between 1 and 3 valid categories");
    const tags = body.tags as string[];
    const client = serviceClient();
    const release = await client.from("package_releases").select("id,owner_id,thumbnail_path").eq("id", releaseId).maybeSingle();
    if (release.error) throw release.error;
    if (!release.data) throw new Error("Release not found");
    if (release.data.owner_id !== user.id) throw new Error("Action not permitted");
    let thumbnailPath = release.data.thumbnail_path as string | null;
    let uploadedThumbnail: string | null = null;
    if (body.thumbnail) {
      const mimeType = body.thumbnail.mimeType ?? "";
      const extension = MIME_EXTENSIONS[mimeType];
      const encoded = body.thumbnail.data ?? "";
      if (!extension || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw new Error("A valid thumbnail is required");
      const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
      if (bytes.byteLength < 1 || bytes.byteLength > 2 * 1024 * 1024) throw new Error("Thumbnail must be smaller than 2 MB");
      uploadedThumbnail = `${releaseId}/${crypto.randomUUID()}.${extension}`;
      const upload = await client.storage.from("package-thumbnails").upload(uploadedThumbnail, bytes, { contentType: mimeType, upsert: false });
      if (upload.error) throw upload.error;
      thumbnailPath = uploadedThumbnail;
    } else if (body.removeThumbnail) thumbnailPath = null;
    const update = await client.from("package_releases").update({
      listing_name: name,
      listing_description: description,
      listing_tags: tags,
      ...(body.thumbnail || body.removeThumbnail ? { thumbnail_path: thumbnailPath } : {}),
    }).eq("id", releaseId);
    if (update.error) {
      if (uploadedThumbnail) await client.storage.from("package-thumbnails").remove([uploadedThumbnail]);
      throw update.error;
    }
    if ((body.thumbnail || body.removeThumbnail) && release.data.thumbnail_path && release.data.thumbnail_path !== thumbnailPath) await client.storage.from("package-thumbnails").remove([release.data.thumbnail_path]);
    return json({ updated: true, thumbnailRemoved: Boolean(body.removeThumbnail), thumbnailPath });
  } catch (error) {
    return errorResponse(error);
  }
});
