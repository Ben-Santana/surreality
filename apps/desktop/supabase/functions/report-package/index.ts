import { corsHeaders, enforceRateLimit, errorResponse, json, requiredUser, serviceClient } from "../_shared/community.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await requiredUser(request);
    await enforceRateLimit("report", user.id, 20);
    const body = await request.json() as { releaseId?: string; reason?: string };
    const releaseId = body.releaseId?.trim() ?? "";
    const reason = body.reason?.trim() ?? "";
    if (!releaseId || reason.length < 3 || reason.length > 500) throw new Error("A report reason between 3 and 500 characters is required");
    const client = serviceClient();
    const release = await client.from("package_releases").select("id,owner_id").eq("id", releaseId).maybeSingle();
    if (release.error) throw release.error;
    if (!release.data) throw new Error("Release not found");
    if (release.data.owner_id === user.id) throw new Error("You cannot report your own package");
    const result = await client.from("package_reports").upsert({ release_id: releaseId, reporter_id: user.id, reason, status: "open" }, { onConflict: "release_id,reporter_id" });
    if (result.error) throw result.error;
    return json({ reported: true });
  } catch (error) {
    return errorResponse(error);
  }
});

