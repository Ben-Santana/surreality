import { corsHeaders, errorResponse, isAdmin, json, requiredUser, serviceClient } from "../_shared/community.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await requiredUser(request);
    const body = await request.json() as { releaseId?: string; action?: "approve" | "reject" | "take_down" | "restore"; reason?: string };
    if (!body.releaseId || !body.action) throw new Error("Release id and action are required");
    const client = serviceClient();
    const release = await client.from("package_releases").select("id,owner_id,status,approved_native,manifest").eq("id", body.releaseId).maybeSingle();
    if (release.error) throw release.error;
    if (!release.data) throw new Error("Release not found");
    const admin = await isAdmin(user.id);
    const owner = release.data.owner_id === user.id;
    if (!admin && !(owner && (body.action === "take_down" || body.action === "restore"))) throw new Error("Action not permitted");
    if ((body.action === "approve" || body.action === "reject") && !admin) throw new Error("Action not permitted");
    if (body.action === "approve" && release.data.status !== "pending_review") throw new Error("Only pending releases can be approved");
    if (body.action === "reject" && release.data.status !== "pending_review") throw new Error("Only pending releases can be rejected");
    if (body.action === "take_down" && release.data.status === "taken_down") throw new Error("Release is already taken down");
    if (body.action === "restore" && release.data.status !== "taken_down") throw new Error("Only taken-down releases can be restored");
    const reason = body.reason?.trim() || null;
    if ((body.action === "reject" || (body.action === "take_down" && admin && !owner)) && !reason) throw new Error("A reason is required");
    const permissions = Array.isArray((release.data.manifest as { permissions?: unknown }).permissions)
      ? (release.data.manifest as { permissions: unknown[] }).permissions : [];
    const native = permissions.includes("system:unrestricted");
    const nextStatus = body.action === "approve" ? "published"
      : body.action === "reject" ? "rejected"
        : body.action === "take_down" ? "taken_down"
          : native && !release.data.approved_native ? "pending_review" : "published";
    const update = await client.from("package_releases").update({
      status: nextStatus,
      status_reason: reason,
      approved_native: body.action === "approve" ? true : release.data.approved_native,
      published_at: nextStatus === "published" ? new Date().toISOString() : undefined,
      taken_down_at: nextStatus === "taken_down" ? new Date().toISOString() : null,
    }).eq("id", release.data.id).select("id,status,status_reason,approved_native").single();
    if (update.error) throw update.error;
    const audit = await client.from("moderation_actions").insert({
      release_id: release.data.id,
      actor_id: user.id,
      action: body.action,
      reason,
    });
    if (audit.error) throw audit.error;
    return json(update.data);
  } catch (error) {
    return errorResponse(error);
  }
});
