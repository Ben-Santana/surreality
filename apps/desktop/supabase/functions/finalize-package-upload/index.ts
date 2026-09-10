import { corsHeaders, enforceRateLimit, errorResponse, json, MAX_ARCHIVE_BYTES, requiredUser, serviceClient, sha256, validateArchive } from "../_shared/community.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  let failedStagingPath: string | null = null;
  try {
    const user = await requiredUser(request);
    await enforceRateLimit("upload", user.id, 10);
    const body = await request.json() as { path?: string };
    const stagingPath = body.path ?? "";
    if (!stagingPath.startsWith(`staging/${user.id}/`) || !stagingPath.endsWith(".surreality")) throw new Error("Invalid staging path");
    failedStagingPath = stagingPath;
    const client = serviceClient();
    const staged = await client.storage.from("user-packages").list(`staging/${user.id}`, { limit: 100 });
    if (!staged.error) {
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      const stale = staged.data.filter((item) => item.created_at && Date.parse(item.created_at) < cutoff).map((item) => `staging/${user.id}/${item.name}`).filter((item) => item !== stagingPath);
      if (stale.length) await client.storage.from("user-packages").remove(stale);
    }
    const profile = await client.from("profiles").select("username").eq("id", user.id).single();
    if (profile.error) throw profile.error;
    if (!profile.data.username) throw new Error("Choose a public username before uploading");
    const download = await client.storage.from("user-packages").download(stagingPath);
    if (download.error) throw download.error;
    if (download.data.size < 1 || download.data.size > MAX_ARCHIVE_BYTES) throw new Error("Package is missing or larger than 50 MB");
    const bytes = await download.data.arrayBuffer();
    let parsed: unknown;
    try { parsed = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Error("Package is not valid JSON"); }
    const { manifest, native } = validateArchive(parsed);
    const digest = await sha256(bytes);

    const namespace = await client.from("package_namespaces").select("owner_id").eq("package_id", manifest.id).maybeSingle();
    if (namespace.error) throw namespace.error;
    let claimedNamespace = false;
    if (namespace.data && namespace.data.owner_id !== user.id) throw new Error("This package id belongs to another publisher");
    if (!namespace.data) {
      const claim = await client.from("package_namespaces").insert({ package_id: manifest.id, owner_id: user.id });
      if (claim.error) {
        const winner = await client.from("package_namespaces").select("owner_id").eq("package_id", manifest.id).single();
        if (winner.error || winner.data.owner_id !== user.id) throw new Error("This package id belongs to another publisher");
      } else claimedNamespace = true;
    }

    const releaseId = crypto.randomUUID();
    const canonicalPath = `releases/${releaseId}/${digest}.surreality`;
    const move = await client.storage.from("user-packages").move(stagingPath, canonicalPath);
    if (move.error) throw move.error;
    const status = native ? "pending_review" : "published";
    const insert = await client.from("package_releases").insert({
      id: releaseId,
      package_id: manifest.id,
      owner_id: user.id,
      version: manifest.version,
      manifest,
      sha256: digest,
      byte_size: bytes.byteLength,
      storage_path: canonicalPath,
      status,
      published_at: status === "published" ? new Date().toISOString() : null,
    }).select("id,package_id,version,status,created_at").single();
    if (insert.error) {
      await client.storage.from("user-packages").remove([canonicalPath]);
      if (claimedNamespace) await client.from("package_namespaces").delete().eq("package_id", manifest.id).eq("owner_id", user.id);
      if (insert.error.code === "23505") throw new Error("That package version or archive already exists");
      throw insert.error;
    }
    return json(insert.data, 201);
  } catch (error) {
    if (failedStagingPath) await serviceClient().storage.from("user-packages").remove([failedStagingPath]);
    return errorResponse(error);
  }
});
