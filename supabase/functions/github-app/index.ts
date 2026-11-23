import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = () => (Deno.env.get("VIBEVAULT_APP_ORIGINS") || "https://vibevault.vibevault-hq.workers.dev,https://feature-vault-browser-github-connect-vibevault.vibevault-hq.workers.dev,http://localhost:5173").split(",").map(value => value.trim()).filter(Boolean);
const cors = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Vary": "Origin",
});
const json = (body: Record<string, unknown>, status = 200, origin = "*") =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json" } });

function encode64url(bytes: Uint8Array) {
  let value = "";
  bytes.forEach(byte => { value += String.fromCharCode(byte); });
  return btoa(value).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function decode64url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const decoded = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(decoded, character => character.charCodeAt(0));
}
async function hash(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
async function signState(payload: Record<string, unknown>, secret: string) {
  const encoded = encode64url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encoded));
  return encoded + "." + encode64url(new Uint8Array(signature));
}
async function verifyState(state: string, secret: string) {
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) return null;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify("HMAC", key, decode64url(signature), new TextEncoder().encode(encoded));
  if (!valid) return null;
  try { return JSON.parse(new TextDecoder().decode(decode64url(encoded))) as Record<string, unknown>; }
  catch { return null; }
}
function privateKeyBytes(pem: string) {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----/g, "").replace(/-----END PRIVATE KEY-----/g, "").replace(/\s/g, "");
  if (!body) throw new Error("GITHUB_APP_PRIVATE_KEY must be a PKCS#8 PEM key.");
  return decode64url(body.replace(/\+/g, "-").replace(/\//g, "_"));
}
async function createAppJwt() {
  const appId = Deno.env.get("GITHUB_APP_ID");
  const pem = Deno.env.get("GITHUB_APP_PRIVATE_KEY");
  if (!appId || !pem) throw new Error("GitHub App credentials are not configured.");
  const key = await crypto.subtle.importKey("pkcs8", privateKeyBytes(pem), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const now = Math.floor(Date.now() / 1000);
  const header = encode64url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const payload = encode64url(new TextEncoder().encode(JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId })));
  const unsigned = header + "." + payload;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  return unsigned + "." + encode64url(new Uint8Array(signature));
}
async function githubApi(path: string, token: string, method = "GET", body?: unknown) {
  const response = await fetch("https://api.github.com" + path, {
    method,
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": "Bearer " + token,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "VibeVault-GitHub-App",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new Error("GitHub API returned " + response.status + ".");
  return response.status === 204 ? null : await response.json();
}
async function createInstallationToken(installationId: number) {
  const result = await githubApi("/app/installations/" + installationId + "/access_tokens", await createAppJwt(), "POST", {
    permissions: { contents: "read", metadata: "read" },
  });
  return String(result.token || "");
}

Deno.serve(async (request: Request) => {
  const origins = allowedOrigins();
  const requestOrigin = request.headers.get("origin") || "";
  const corsOrigin = origins.includes(requestOrigin) ? requestOrigin : (origins[0] || "*");
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors(corsOrigin) });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: "Supabase Function configuration is incomplete." }, 500, corsOrigin);
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // GitHub's setup redirect is unauthenticated; the signed one-time state identifies the initiating VibeVault user.
  if (request.method === "GET") {
    const params = new URL(request.url).searchParams;
    const installationId = Number(params.get("installation_id"));
    const setupAction = params.get("setup_action") || "";
    const stateSecret = Deno.env.get("GITHUB_STATE_SECRET") || "";
    const state = await verifyState(params.get("state") || "", stateSecret);
    const returnOrigin = String(state?.origin || "");
    const fallback = origins[0] || "https://vibevault.vibevault-hq.workers.dev";
    const fail = (message: string) => Response.redirect(
      (origins.includes(returnOrigin) ? returnOrigin : fallback) + "/app?github=failed&message=" + encodeURIComponent(message), 302
    );

    if (!state || !stateSecret || !origins.includes(returnOrigin) || Number(state.exp || 0) < Date.now() ||
      !Number.isFinite(installationId) || installationId <= 0 || !["install", "update"].includes(setupAction)) {
      return fail("GitHub installation state expired or could not be verified.");
    }

    const userId = String(state.user_id || "");
    const nonce = String(state.nonce || "");
    if (!userId || !nonce) return fail("GitHub installation state is incomplete.");

    const { data: pending, error: pendingError } = await admin.from("github_app_states")
      .select("id,user_id,return_origin,expires_at,used_at")
      .eq("nonce_hash", await hash(nonce)).eq("user_id", userId).is("used_at", null).maybeSingle();
    if (pendingError || !pending || pending.return_origin !== returnOrigin || new Date(pending.expires_at).getTime() < Date.now()) {
      return fail("GitHub installation state was already used or has expired.");
    }

    try {
      const installation = await githubApi("/app/installations/" + installationId, await createAppJwt());
      const account = installation.account || {};
      const { error: markUsedError } = await admin.from("github_app_states")
        .update({ used_at: new Date().toISOString() }).eq("id", pending.id).is("used_at", null);
      if (markUsedError) throw markUsedError;

      const { error: saveError } = await admin.from("github_installations").upsert({
        user_id: userId,
        installation_id: installationId,
        account_id: Number(account.id || 0),
        account_login: String(account.login || "GitHub account"),
        account_type: String(account.type || "User"),
        repository_selection: String(installation.repository_selection || "selected"),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (saveError) throw saveError;
      return Response.redirect(returnOrigin + "/app?github=connected", 302);
    } catch {
      return fail("GitHub could not verify the App installation. Check the GitHub App settings.");
    }
  }

  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, corsOrigin);
  if (requestOrigin && !origins.includes(requestOrigin)) return json({ error: "This VibeVault origin is not allowed." }, 403, corsOrigin);

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Authentication is required." }, 401, corsOrigin);
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json({ error: "Your VibeVault session is invalid or expired." }, 401, corsOrigin);

  let body: { action?: string; return_origin?: string };
  try { body = await request.json(); }
  catch { return json({ error: "Request body must be valid JSON." }, 400, corsOrigin); }

  if (body.action === "start") {
    const appSlug = Deno.env.get("GITHUB_APP_SLUG");
    const stateSecret = Deno.env.get("GITHUB_STATE_SECRET");
    if (!appSlug || !stateSecret || !Deno.env.get("GITHUB_APP_ID") || !Deno.env.get("GITHUB_APP_PRIVATE_KEY")) {
      return json({ error: "GitHub App is not configured. Set its slug, ID, PKCS#8 private key and state secret in Supabase Function secrets." }, 503, corsOrigin);
    }
    const returnOrigin = String(body.return_origin || requestOrigin);
    if (!origins.includes(returnOrigin)) return json({ error: "This return origin is not allowed." }, 403, corsOrigin);

    const nonce = encode64url(crypto.getRandomValues(new Uint8Array(32)));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const signedState = await signState({ user_id: authData.user.id, origin: returnOrigin, nonce, exp: Date.now() + 10 * 60 * 1000 }, stateSecret);
    const { error: stateError } = await admin.from("github_app_states").insert({
      user_id: authData.user.id, nonce_hash: await hash(nonce), return_origin: returnOrigin, expires_at: expiresAt,
    });
    if (stateError) return json({ error: "Could not create a secure GitHub installation session." }, 500, corsOrigin);

    return json({
      install_url: "https://github.com/apps/" + encodeURIComponent(appSlug) + "/installations/new?state=" + encodeURIComponent(signedState),
    }, 200, corsOrigin);
  }

  if (body.action === "repositories") {
    const { data: installation, error: installationError } = await admin.from("github_installations")
      .select("installation_id,account_login,account_type,repository_selection")
      .eq("user_id", authData.user.id).maybeSingle();
    if (installationError) return json({ error: "Could not read the GitHub App connection." }, 500, corsOrigin);
    if (!installation) return json({ connected: false, repositories: [] }, 200, corsOrigin);

    try {
      const installationToken = await createInstallationToken(Number(installation.installation_id));
      if (!installationToken) throw new Error("GitHub did not return an installation token.");
      const repositories: Record<string, unknown>[] = [];
      for (let page = 1; page <= 5; page += 1) {
        const result = await githubApi("/installation/repositories?per_page=100&page=" + page, installationToken);
        const items = Array.isArray(result.repositories) ? result.repositories : [];
        repositories.push(...items.map((item: Record<string, unknown>) => ({
          id: item.id, full_name: item.full_name, html_url: item.html_url,
          private: item.private, description: item.description, language: item.language,
          default_branch: item.default_branch, updated_at: item.updated_at, archived: item.archived,
        })));
        if (items.length < 100) break;
      }
      return json({
        connected: true,
        account: { login: installation.account_login, type: installation.account_type },
        repository_selection: installation.repository_selection,
        repositories,
      }, 200, corsOrigin);
    } catch {
      return json({ error: "Could not list repositories. Check the GitHub App installation and read-only Metadata/Contents permissions." }, 502, corsOrigin);
    }
  }

  if (body.action === "disconnect") {
    const { error: deleteError } = await admin.from("github_installations").delete().eq("user_id", authData.user.id);
    if (deleteError) return json({ error: "Could not remove the GitHub App connection." }, 500, corsOrigin);
    return json({ disconnected: true }, 200, corsOrigin);
  }

  return json({ error: "Unknown GitHub App action." }, 400, corsOrigin);
});
