// VibeVault browser-capture ingestion endpoint.
// Deploy: supabase functions deploy capture-conversation
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return Response.json({ error: "Server integration is not configured." }, { status: 500, headers: cors });

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token.startsWith("vv_capture_")) return Response.json({ error: "A valid capture token is required." }, { status: 401, headers: cors });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: integration, error: tokenError } = await admin.from("integration_tokens")
    .select("id,user_id,scope,revoked_at").eq("token_hash", await sha256(token)).eq("scope", "capture").is("revoked_at", null).maybeSingle();
  if (tokenError || !integration) return Response.json({ error: "Capture token is invalid or revoked." }, { status: 401, headers: cors });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return Response.json({ error: "Expected JSON body." }, { status: 400, headers: cors }); }
  const source = String(body.source_ai || "Other");
  const allowed = ["Claude","ChatGPT","Gemini","Cursor","Windsurf","Perplexity","DeepSeek","Lovable","Base44","Trae","Qoder","Other"];
  const title = String(body.title || "Captured conversation").trim().slice(0, 180);
  const raw = String(body.raw_content || "");
  if (!allowed.includes(source)) return Response.json({ error: "Unsupported AI source." }, { status: 400, headers: cors });
  if (!title || !raw.trim() || raw.length > 2_000_000) return Response.json({ error: "A title and conversation under 2 MB are required." }, { status: 400, headers: cors });

  const { data, error } = await admin.from("capture_inbox").insert({
    user_id: integration.user_id,
    source_ai: source,
    title,
    raw_content: raw,
    source_url: typeof body.source_url === "string" ? body.source_url.slice(0, 2000) : null,
    capture_metadata: {
      import_method: "browser_extension",
      captured_at: new Date().toISOString(),
      message_count: Number(body.message_count || 0),
      page_title: typeof body.page_title === "string" ? body.page_title.slice(0, 300) : null
    }
  }).select("id,title,source_ai,created_at").single();
  if (error) return Response.json({ error: "Could not save capture." }, { status: 500, headers: cors });

  await admin.from("integration_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", integration.id);
  return Response.json({ ok: true, capture: data, message: "Capture saved to the VibeVault Import Inbox for review." }, { headers: cors });
});
