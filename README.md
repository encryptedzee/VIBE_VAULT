# VibeVault

**GitHub for your AI brain and dynamic `AGENT.md` handoffs.** A React + Vite + Supabase application using the GAMER Control-Room design system.

## Included

- VibeVault branding with the VV monogram and a responsive public landing page.
- Email/password authentication and GitHub OAuth through Supabase Auth.
- Project workspace with a permanent Conversation Vault, import review inbox, saved AI preferences, and a simplified handoff experience. The technical `AGENT.md` output is hidden behind an advanced control.
- First-run guided AI onboarding: set work focus, experience level, preferred agent behaviour and response detail, then select AI providers, assign each a purpose and choose a default. Preferences are stored per account and included in generated handoffs.
- Professional project transfer dialogs: choose the destination project and receiving AI for manual imports, browser-capture inbox imports and project exports. Saved agents require only confirmation; manually selected agents also require a task purpose.
- MCP project discovery exposes saved agent preferences. MCP import and export tools require explicit project IDs and preserve original conversation text; compatible AI clients must confirm destinations conversationally because they cannot display the VibeVault browser UI.
- Conversation import from pasted text, TXT/Markdown, JSON/JSONL archives (including ChatGPT-style `mapping` exports), with original source payload and import metadata preserved separately from cleaned specifications.
- Project export as a portable JSON bundle containing project metadata, original conversations, source payloads, decisions, session summaries, handoff history and saved AI preferences; individual raw threads can be exported as Markdown.
- Browser Capture extension (Chrome/Chromium MV3) for ChatGPT, Claude and Gemini. It captures the currently open conversation after an explicit click and sends it to a review inbox; users choose the project before it enters the permanent Vault.
- Remote MCP server for compatible AI clients. Read tools list projects, search conversations and retrieve project context; write tools save session summaries and project decisions. MCP does not pull full transcripts from private AI accounts automatically.
- Hashed, revocable integration tokens for the browser extension and MCP connection. Plaintext tokens are displayed once.
- Starter caps: 1 project, 3 saved raw conversations, and the 3 built-in role skills.
- Pro and Founder Lifetime pricing cards, Polar/card checkout handoff, and Tanzania M-Pesa Lipa Namba instructions.
- One-click Claude and ChatGPT launch actions that also persist handoff records.
- Pro AI Smart Spec Cleaner invocation with saved `cleaned_spec` output, while the raw thread remains unchanged.
- Per-conversation RAW THREAD / CLEANED SPEC selection when compiling an `AGENT.md`.
- Supabase Row Level Security and database triggers that enforce Starter caps for project, conversation and skill inserts.

## Run locally

Requirements: Node.js 20.19+ or 22.12+ and npm.

```bash
npm install
cp .env.example .env
npm run dev
```

Configure the environment values in `.env`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
VITE_PRO_CHECKOUT_URL=
VITE_LIFETIME_CHECKOUT_URL=
VITE_LIPA_NAMBA=
VITE_LIPA_NAME=
```

The checkout URLs are the Polar (or other hosted checkout) payment links for the respective plans. The M-Pesa fields are the business Lipa Namba and account name shown to customers. These `VITE_` values are public client configuration; never put secrets, private API keys, or a Supabase service-role key in them.

## Supabase setup

1. Create a Supabase project.
2. Run the complete `supabase/schema.sql` in the Supabase SQL Editor. Re-run it after pulling updates to refresh the Starter-limit trigger functions.
3. Re-run the complete `supabase/schema.sql` after pulling this update. The migration adds AI preferences, capture inbox, hashed integration tokens, project decisions and session summaries. It also replaces the child-table project ownership checks with a `SECURITY DEFINER` helper to avoid policy recursion from project lookups.
4. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in your local `.env`.
5. In **Authentication → Providers**, enable Email and GitHub. In the GitHub OAuth application, use the Supabase callback URL shown by Supabase (the URL ending in `/auth/v1/callback`); this is GitHub's provider callback and is not the VibeVault app callback.
6. In **Authentication → URL Configuration**, keep the Site URL set to your production app origin and add these app callback URLs to the allowed Redirect URLs:
   - Production: `https://vibevault.vibevault-hq.workers.dev/auth/callback`
   - Local development: `http://localhost:5173/auth/callback`
   - Cloudflare feature-branch preview: `https://feature-professional-workspace-redesign-vibevault.vibevault-hq.workers.dev/auth/callback`

   The feature-preview callback is essential when testing GitHub OAuth on the preview domain. VibeVault requests `window.location.origin + '/auth/callback'`; Supabase only honors that redirect when it matches an allowed URL. If the preview callback is missing, Supabase can fall back to the configured Site URL and send the user to the production workspace, which will still show the old production UI. Keep the production Site URL unchanged.

   Use the stable branch Preview URL for sign-in tests, not a one-off deployment URL: the branch Preview hostname stays the same across commits.
7. Deploy the two new integration functions with JWT verification disabled because they authenticate using their own revocable VibeVault tokens:

```bash
supabase functions deploy capture-conversation --no-verify-jwt
supabase functions deploy mcp --no-verify-jwt
```

Set the Supabase Edge Function secret `SUPABASE_SERVICE_ROLE_KEY` (Supabase normally provides this in the Edge Function environment; confirm it exists before testing). Never expose it in a `VITE_` variable or browser extension.
8. Restart Vite after changing environment values.

Do not grant browser clients permission to update `profiles.is_pro`. The schema restricts profile updates to non-entitlement fields. Set Pro entitlements only from a trusted payment webhook or a secured administrative process.


## Conversation import and browser capture

### Manual import and archive migration

The in-app **IMPORT CONVERSATION** flow opens a destination card first. Choose the project that should own the incoming threads, then confirm a saved AI agent or manually choose another AI and describe its purpose. It accepts pasted text, TXT, Markdown, JSON and JSONL. It understands common ChatGPT export conversation records containing a `mapping` object and stores each extracted transcript with the original source payload in `conversations.source_payload`. ZIP files are not unpacked in the browser: extract the archive first and select its JSON file. For a multi-conversation archive, choose the provider once; the selected source is applied to the imported records. Imported threads are assigned to the currently selected project. The original transcript is never replaced by the AI cleaner.

### Install the browser extension

1. In VibeVault, open **CONNECTIONS → CREATE CAPTURE TOKEN** and copy the token. It is shown only once; if lost, revoke it and create another.
2. In Chrome/Chromium, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select this repository's `browser-extension` directory.
3. Open the extension settings and enter the Supabase project URL, public anon key, and capture token.
4. Open a supported ChatGPT, Claude or Gemini conversation, click the extension, then **CAPTURE THIS CONVERSATION**.
5. Open VibeVault → **IMPORT INBOX**, review the capture, select a project and choose **ADD TO VAULT**.

Capture is explicit and page-specific. The extension does not run an automatic background export, does not bypass provider access controls, and does not guarantee every UI variant will be readable. Provider page markup can change, so selectors may need maintenance. Captured full transcripts are sent to the user's VibeVault Supabase project and retained in the review inbox until the user imports or discards them.

## MCP connection

The remote MCP endpoint is:

`https://YOUR_PROJECT.supabase.co/functions/v1/mcp`

Create an **MCP Server Connection** token under **CONNECTIONS** and configure a compatible MCP client with the endpoint and token as a Bearer credential. The server currently exposes:

- `list_projects`
- `search_conversations`
- `get_project_context`
- `get_handoff_context`
- `save_session_summary`
- `export_project_bundle` — export a selected project with its original conversations, decisions, summaries, global style and transfer destination metadata.
- `import_conversations` — import user-supplied raw threads into a project selected by the user; raw text is stored without rewriting.
- `save_project_decision`

MCP can retrieve VibeVault project knowledge and save the summary/decisions the connected AI explicitly sends. The `list_projects` tool also returns the user's saved AI agents and default destination. Before an MCP import or export, the connected AI should show the available project choices and ask the user to confirm the destination. If the user keeps a saved agent, show its name and ask for confirmation; if they manually choose a different AI, ask what it should be used for. MCP clients cannot open an in-app VibeVault modal, so this confirmation happens in the connected AI conversation. It does not independently read every message from the AI provider's private chat history and does not promise full raw transcript capture. Use the browser extension or provider export/API for transcript capture. Write tools are authorized by the user's token and project ownership; an AI client should only save decisions the user has approved.

## Export

**EXPORT PROJECT** downloads a JSON bundle for the selected project, including its metadata, raw conversations, source payloads, session summaries, decisions, handoff history and saved AI preferences. The conversation detail view also offers a Markdown export for an individual raw thread. Store exported files securely; they may contain private conversation data.


## AI Smart Spec Cleaner

The Pro UI calls the Supabase Edge Function:

```js
supabase.functions.invoke('clean-spec', {
  body: { raw_content, conversation_id }
})
```

The function in `supabase/functions/clean-spec/index.ts` authenticates the caller, verifies Pro entitlement, confirms that the conversation belongs to the caller and that the submitted raw text matches the saved original, then returns JSON containing `cleaned_spec`. It uses an OpenAI-compatible Chat Completions endpoint configured through Edge Function secrets. The client persists the returned spec to the same conversation row; the function never overwrites `raw_content`.

Deploy it with the Supabase CLI:

```bash
supabase functions deploy clean-spec
supabase secrets set AI_API_KEY=YOUR_PROVIDER_KEY AI_API_URL=https://api.openai.com/v1/chat/completions AI_MODEL=gpt-4o-mini
```

The `AI_API_URL` and `AI_MODEL` settings can point to another OpenAI-compatible provider and model. Keep provider credentials in Supabase Function Secrets, never in browser `VITE_` variables.

## Billing and entitlement lifecycle

The checkout modal opens the configured hosted checkout URL with `customer_email`. Tanzania customers can use the displayed Lipa Namba and must include their VibeVault account email in the payment reference. These front-end steps do not independently verify payment.

To activate Pro reliably, implement a trusted Polar/payment-provider webhook that verifies payment signatures, maps the checkout customer to the VibeVault user, and updates `profiles.is_pro` server-side. Founder Lifetime should grant the same Pro entitlement permanently. The **REFRESH PLAN STATUS** control re-reads the current profile flag; it does not itself verify or process a payment.

## Build and deploy

```bash
npm run build
npm run preview
```

Deploy the generated `dist/` directory to Vercel, Netlify, Cloudflare Pages, or another static host. Configure all six `VITE_` variables in the host environment and set the production origin in Supabase Auth.

Before production launch, verify the new SQL migration in a staging Supabase project, test capture and MCP tokens end-to-end, harden extension selectors against provider UI changes, complete verified billing webhooks and payment reconciliation, monitoring, backups, privacy/retention policy, and automated security and end-to-end tests.

## Repository

https://github.com/encryptedzee/VIBE_VAULT
