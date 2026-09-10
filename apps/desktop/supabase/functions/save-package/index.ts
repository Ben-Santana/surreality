import { corsHeaders, enforceRateLimit, errorResponse, json, requiredUser, serviceClient } from "../_shared/community.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await requiredUser(request);
    await enforceRateLimit("save", user.id, 120);
    const body = await request.json() as { releaseId?: string; saved?: boolean };
    const releaseId = body.releaseId?.trim() ?? "";
    if (!releaseId || typeof body.saved !== "boolean") throw new Error("Release id and saved state are required");
    const client = serviceClient();
    if (body.saved) {
      const release = await client.from("package_releases").select("id,status").eq("id", releaseId).maybeSingle();
      if (release.error) throw release.error;
      if (!release.data || release.data.status !== "published") throw new Error("Published release not found");
      const save = await client.from("package_saves").upsert({ user_id: user.id, release_id: releaseId }, { onConflict: "user_id,release_id", ignoreDuplicates: true });
      if (save.error) throw save.error;
    } else {
      const remove = await client.from("package_saves").delete().eq("user_id", user.id).eq("release_id", releaseId);
      if (remove.error) throw remove.error;
    }
    return json({ saved: body.saved });
  } catch (error) {
    return errorResponse(error);
  }
});

