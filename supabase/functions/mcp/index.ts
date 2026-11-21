// VibeVault remote MCP server (HTTP JSON-RPC, stateless).
// Deploy: supabase functions deploy mcp
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, mcp-session-id",
  "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
};

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const tools = [
  { name: "list_projects", description: "List the connected user's VibeVault projects.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "search_conversations", description: "Search the user's preserved conversations by text and optional project.", inputSchema: { type: "object", properties: { query: { type: "string" }, project_id: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 20 } }, required: ["query"], additionalProperties: false } },
  { name: "get_project_context", description: "Retrieve project description, rules, approved decisions, open questions, session summaries and recent conversation references.", inputSchema: { type: "object", properties: { project_id: { type: "string" } }, required: ["project_id"], additionalProperties: false } },
  { name: "get_handoff_context", description: "Prepare a project-specific context bundle for continuing work in this AI application.", inputSchema: { type: "object", properties: { project_id: { type: "string" }, task: { type: "string" } }, required: ["project_id"], additionalProperties: false } },
  { name: "export_project_bundle", description: "Export a user's project context bundle. First list_projects and ask the user which destination project to use; use their explicit project_id. Include the receiving AI and task purpose in transfer_context. Never guess the destination.", inputSchema: { type: "object", properties: { project_id: { type: "string" }, target_ai: { type: "string" }, task_purpose: { type: "string" } }, required: ["project_id","target_ai"], additionalProperties: false } },
  { name: "import_conversations", description: "Import user-supplied original conversation records into the selected VibeVault project. First list_projects and ask the user to choose the destination; do not guess. Preserve raw_content exactly. If the user has a saved agent preference, show its name and ask for confirmation. If they manually choose an AI, also ask what it should be used for.", inputSchema: { type: "object", properties: { project_id: { type: "string" }, target_ai: { type: "string" }, agent_mode: { type: "string", enum: ["saved","manual"] }, task_purpose: { type: "string" }, conversations: { type: "array", minItems: 1, maxItems: 40, items: { type: "object", properties: { title: { type: "string" }, source_ai: { type: "string" }, raw_content: { type: "string" }, tags: { type: "array", items: { type: "string" } } }, required: ["title","source_ai","raw_content"], additionalProperties: false } } }, required: ["project_id","target_ai","agent_mode","conversations"], additionalProperties: false } },
  { name: "save_session_summary", description: "Save a summary of this AI work session to the selected VibeVault project. This is not a full raw transcript.", inputSchema: { type: "object", properties: { project_id: { type: "string" }, title: { type: "string" }, summary: { type: "string" }, source_ai: { type: "string" } }, required: ["project_id", "title", "summary"], additionalProperties: false } },
  { name: "save_project_decision", description: "Save a user-approved project decision or an unresolved question. Do not mark an unapproved suggestion as approved.", inputSchema: { type: "object", properties: { project_id: { type: "string" }, title: { type: "string" }, content: { type: "string" }, status: { type: "string", enum: ["approved", "proposed", "open", "resolved", "superseded"] }, source_ai: { type: "string" } }, required: ["project_id", "title", "content"], additionalProperties: false } }
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method === "GET") return new Response("VibeVault MCP endpoint. Send MCP JSON-RPC requests using POST.", { headers: cors });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return Response.json({ error: "MCP server is not configured." }, { status: 500, headers: cors });
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token.startsWith("vv_mcp_")) return Response.json({ error: "A valid MCP token is required." }, { status: 401, headers: cors });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: integration } = await admin.from("integration_tokens").select("id,user_id")
    .eq("token_hash", await sha256(token)).eq("scope", "mcp").is("revoked_at", null).maybeSingle();
  if (!integration) return Response.json({ error: "MCP token is invalid or revoked." }, { status: 401, headers: cors });
  await admin.from("integration_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", integration.id);

  let rpc: any;
  try { rpc = await req.json(); } catch { return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400, headers: cors }); }
  const respond = (result: unknown, status = 200) => Response.json({ jsonrpc: "2.0", id: rpc.id ?? null, result }, { status, headers: { ...cors, "Content-Type": "application/json" } });
  const fail = (code: number, message: string) => Response.json({ jsonrpc: "2.0", id: rpc.id ?? null, error: { code, message } }, { status: 200, headers: { ...cors, "Content-Type": "application/json" } });

  if (rpc.method === "notifications/initialized") return new Response(null, { status: 202, headers: cors });
  if (rpc.method === "initialize") return respond({
    protocolVersion: rpc.params?.protocolVersion || "2024-11-05",
    capabilities: { tools: { listChanged: false } },
    serverInfo: { name: "vibevault", version: "1.0.0" },
    instructions: "VibeVault is the user's project memory. Read project context before work. Save only useful session summaries and explicitly approved decisions. This connection does not retrieve a complete third-party chat transcript."
  });
  if (rpc.method === "ping") return respond({});
  if (rpc.method === "tools/list") return respond({ tools });

  if (rpc.method === "tools/call") {
    const name = String(rpc.params?.name || "");
    const args = rpc.params?.arguments || {};
    const projectId = String(args.project_id || "");
    const content = (value: unknown) => ({ content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] });
    try {
      if (name === "list_projects") {
        const { data, error } = await admin.from("projects").select("id,title,description,updated_at").eq("user_id", integration.user_id).order("updated_at", { ascending: false }).limit(100);
        if (error) throw error;
        return respond(content(data || []));
      }
      if (name === "search_conversations") {
        const query = String(args.query || "").trim();
        if (!query) return respond(content("Provide a non-empty search query."));
        let request = admin.from("conversations").select("id,project_id,title,source_ai,tags,created_at,raw_content").eq("user_id", integration.user_id).ilike("raw_content", "%" + query.slice(0, 100) + "%").limit(Math.min(Math.max(Number(args.limit || 8), 1), 20));
        if (args.project_id) request = request.eq("project_id", String(args.project_id));
        const { data, error } = await request;
        if (error) throw error;
        return respond(content((data || []).map(item => ({ ...item, raw_content: item.raw_content.slice(0, 12000) }))));
      }
      if (name === "export_project_bundle") {
        if (!projectId || !String(args.target_ai || "").trim()) return fail(-32602, "project_id and target_ai are required.");
        const { data: project, error: projectError } = await admin.from("projects").select("*").eq("id", projectId).eq("user_id", integration.user_id).maybeSingle();
        if (projectError) throw projectError;
        if (!project) return respond(content("Project not found or not accessible."));
        const [conversations, decisions, summaries, handoffs, profile] = await Promise.all([
          admin.from("conversations").select("*").eq("project_id", projectId).eq("user_id", integration.user_id).order("created_at", { ascending: true }),
          admin.from("project_decisions").select("*").eq("project_id", projectId).eq("user_id", integration.user_id).order("created_at", { ascending: true }),
          admin.from("session_summaries").select("*").eq("project_id", projectId).eq("user_id", integration.user_id).order("created_at", { ascending: true }),
          admin.from("handoffs").select("target_ai,role_name,confirmed,created_at").eq("project_id", projectId).eq("user_id", integration.user_id).order("created_at", { ascending: true }),
          admin.from("profiles").select("ai_preferences,global_style").eq("id", integration.user_id).maybeSingle()
        ]);
        for (const result of [conversations, decisions, summaries, handoffs, profile]) if (result.error) throw result.error;
        const prefs = profile.data?.ai_preferences || {};
        const target = String(args.target_ai).slice(0, 80);
        const savedRole = prefs.providers?.[target]?.role || "";
        return respond(content({
          format: "vibevault-project-export", version: 1, exported_at: new Date().toISOString(),
          project, conversations: conversations.data || [], decisions: decisions.data || [],
          session_summaries: summaries.data || [], handoffs: handoffs.data || [],
          global_style: profile.data?.global_style || "", ai_preferences: prefs,
          transfer_context: { target_ai: target, agent_role: String(args.task_purpose || savedRole).slice(0, 3000), task_purpose: String(args.task_purpose || "").slice(0, 3000) }
        }));
      }
      if (name === "import_conversations") {
        const items = Array.isArray(args.conversations) ? args.conversations : [];
        if (!projectId || !items.length || !String(args.target_ai || "").trim()) return fail(-32602, "project_id, target_ai and conversations are required.");
        if (items.length > 40) return fail(-32602, "Import up to 40 conversations per MCP request.");
        const { data: project, error: projectError } = await admin.from("projects").select("id,title").eq("id", projectId).eq("user_id", integration.user_id).maybeSingle();
        if (projectError) throw projectError;
        if (!project) return respond(content("Destination project not found or not accessible."));
        const mode = args.agent_mode === "manual" ? "manual" : "saved";
        if (mode === "manual" && !String(args.task_purpose || "").trim()) return fail(-32602, "Manual agent selection requires task_purpose.");
        const { data: profile } = await admin.from("profiles").select("ai_preferences").eq("id", integration.user_id).maybeSingle();
        const preferences = profile?.ai_preferences || {};
        const target = String(args.target_ai).slice(0, 80);
        if (mode === "saved" && !preferences.providers?.[target]?.enabled) return fail(-32602, "This AI is not in the user's saved providers. Ask them to choose a saved provider or select manual mode.");
        const transferContext = { target_ai: target, agent_mode: mode, agent_role: mode === "manual" ? String(args.task_purpose).slice(0, 3000) : String(preferences.providers?.[target]?.role || "").slice(0, 3000), task_purpose: mode === "manual" ? String(args.task_purpose).slice(0, 3000) : "" };
        const rows = items.map((item: any) => ({
          user_id: integration.user_id, project_id: projectId,
          title: String(item.title || "Imported conversation").slice(0, 180),
          source_ai: ["Claude","ChatGPT","Gemini","Cursor","Windsurf","Perplexity","DeepSeek","Lovable","Base44","Trae","Qoder","Other"].includes(item.source_ai) ? item.source_ai : "Other",
          raw_content: String(item.raw_content || ""), tags: Array.isArray(item.tags) ? item.tags.map((tag: unknown) => String(tag).slice(0, 60)).slice(0, 20) : ["mcp-import"],
          capture_metadata: { import_method: "mcp", transfer_context: transferContext }
        }));
        if (rows.some(row => !row.title.trim() || !row.raw_content.trim())) return fail(-32602, "Every imported conversation needs a title and non-empty raw_content.");
        const { data, error } = await admin.from("conversations").insert(rows).select("id,title,source_ai,created_at");
        if (error) throw error;
        return respond(content({ imported: data?.length || 0, project, target_ai: target, agent_mode: mode, records: data || [], note: "Original raw_content was stored without rewriting." }));
      }
      if (name === "get_project_context" || name === "get_handoff_context") {
        const { data: project, error: projectError } = await admin.from("projects").select("id,title,description,project_rules,tags,updated_at").eq("id", projectId).eq("user_id", integration.user_id).maybeSingle();
        if (projectError) throw projectError;
        if (!project) return respond(content("Project not found or not accessible."));
        const [decisions, summaries, conversations] = await Promise.all([
          admin.from("project_decisions").select("category,title,content,status,created_at").eq("project_id", projectId).eq("user_id", integration.user_id).order("created_at", { ascending: false }).limit(50),
          admin.from("session_summaries").select("title,summary,source_ai,created_at").eq("project_id", projectId).eq("user_id", integration.user_id).order("created_at", { ascending: false }).limit(30),
          admin.from("conversations").select("id,title,source_ai,tags,created_at,raw_content,cleaned_spec").eq("project_id", projectId).eq("user_id", integration.user_id).order("created_at", { ascending: false }).limit(20)
        ]);
        if (decisions.error || summaries.error || conversations.error) throw decisions.error || summaries.error || conversations.error;
        const bundle = {
          project,
          task: String(args.task || ""),
          decisions: decisions.data || [],
          session_summaries: summaries.data || [],
          conversations: (conversations.data || []).map(item => ({ id: item.id, title: item.title, source_ai: item.source_ai, tags: item.tags, created_at: item.created_at, content: (item.cleaned_spec || item.raw_content || "").slice(0, 16000) }))
        };
        return respond(content(bundle));
      }
      if (name === "save_session_summary") {
        if (!projectId || !String(args.title || "").trim() || !String(args.summary || "").trim()) return fail(-32602, "project_id, title and summary are required.");
        const { data: project } = await admin.from("projects").select("id").eq("id", projectId).eq("user_id", integration.user_id).maybeSingle();
        if (!project) return respond(content("Project not found or not accessible."));
        const { data, error } = await admin.from("session_summaries").insert({
          user_id: integration.user_id, project_id: projectId,
          title: String(args.title).slice(0, 180), summary: String(args.summary).slice(0, 30000),
          source_ai: String(args.source_ai || "MCP connected AI").slice(0, 80)
        }).select("id,title,created_at").single();
        if (error) throw error;
        return respond(content({ saved: true, record: data }));
      }
      if (name === "save_project_decision") {
        if (!projectId || !String(args.title || "").trim() || !String(args.content || "").trim()) return fail(-32602, "project_id, title and content are required.");
        const { data: project } = await admin.from("projects").select("id").eq("id", projectId).eq("user_id", integration.user_id).maybeSingle();
        if (!project) return respond(content("Project not found or not accessible."));
        const status = ["approved","proposed","open","resolved","superseded"].includes(args.status) ? args.status : "proposed";
        const { data, error } = await admin.from("project_decisions").insert({
          user_id: integration.user_id, project_id: projectId, category: status === "open" ? "open_question" : "decision",
          title: String(args.title).slice(0, 180), content: String(args.content).slice(0, 30000), status,
          source_ai: String(args.source_ai || "MCP connected AI").slice(0, 80)
        }).select("id,title,status,created_at").single();
        if (error) throw error;
        return respond(content({ saved: true, record: data }));
      }
      return fail(-32601, "Unknown VibeVault tool: " + name);
    } catch (error) {
      return fail(-32000, error?.message || "VibeVault operation failed.");
    }
  }
  return fail(-32601, "Method not found: " + String(rpc.method || ""));
});
