import { corsHeaders, enforceRateLimit, errorResponse, isAdmin, json, optionalUser, serviceClient } from "../_shared/community.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await optionalUser(request);
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    await enforceRateLimit("download", user?.id ?? forwarded, 120);
    const body = await request.json() as { releaseId?: string };
    if (!body.releaseId) throw new Error("A release id is required");
    const client = serviceClient();
    const release = await client.from("package_releases")
      .select("id,owner_id,status,storage_path,sha256,byte_size,manifest,package_id,version")
      .eq("id", body.releaseId).maybeSingle();
    if (release.error) throw release.error;
    if (!release.data) throw new Error("Release not found");
    const privileged = Boolean(user && (release.data.owner_id === user.id || await isAdmin(user.id)));
    if (release.data.status !== "published" && !privileged) throw new Error("Release not found");
    if (release.data.status === "taken_down" || release.data.status === "rejected") throw new Error("Release is not available for download");
    const signed = await client.storage.from("user-packages").createSignedUrl(release.data.storage_path, 60, {
      download: `${release.data.package_id}-${release.data.version}.surreality`,
    });
    if (signed.error) throw signed.error;
    if (user) {
      const existing = await client.from("package_downloads").select("download_count,first_downloaded_at")
        .eq("user_id", user.id).eq("release_id", release.data.id).maybeSingle();
      if (existing.error) throw existing.error;
      const history = await client.from("package_downloads").upsert({
        user_id: user.id,
        release_id: release.data.id,
        first_downloaded_at: existing.data?.first_downloaded_at ?? new Date().toISOString(),
        last_downloaded_at: new Date().toISOString(),
        download_count: Number(existing.data?.download_count ?? 0) + 1,
      }, { onConflict: "user_id,release_id" });
      if (history.error) throw history.error;
    }
    return json({
      url: signed.data.signedUrl,
      sha256: release.data.sha256,
      byteSize: release.data.byte_size,
      manifest: release.data.manifest,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
