# VibeVault — BrainRelay

**GitHub for your AI brain and dynamic `AGENT.md` handoffs.** A React + Vite + Tailwind application using the GAMER Control-Room visual system.

## What's included

- Cinematic 1.6-second opening sequence and responsive public landing page.
- Sign-up and sign-in through Supabase Auth.
- Three-panel control room: projects, raw conversation archive, and dynamic handoff engine.
- Exact raw-thread storage, source-AI filters, tags, detail view and Pro-cleaned-spec placeholder.
- Built-in Backend Architect, UI Designer and Image Prompt Engineer skills, plus custom role creation.
- Live `AGENT.md` compiler with project rules, global style, selected raw conversations and a mandatory three-point confirmation block.
- Copy/download handoffs and a persisted confirmation log.
- Supabase schema with Row Level Security policies and per-user data isolation.

## Run locally

Requirements: Node.js 20.19+ or 22.12+ and npm.


```bash
npm install
cp .env.example .env
```

Set these values in `.env` using your Supabase project settings:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Then run:

```bash
npm run dev
```

Open the local URL printed by Vite.

## Connect Supabase

1. Create a Supabase project.
2. Open **SQL Editor** in the Supabase dashboard.
3. Run the complete contents of [`supabase/schema.sql`](./supabase/schema.sql).
4. Add the project URL and anon/public key to `.env`.
5. Restart Vite after changing environment variables.
6. In Supabase Auth settings, configure your site URL and allowed redirect URLs for local development and your eventual production domain.

The migration creates `profiles`, `projects`, `conversations`, `agent_skills`, and `handoffs`, adds the expected timestamps and indexes, creates the three starter skills for new users, and enables RLS. Do not put the Supabase service-role key in a browser `.env` variable.

## Build for deployment

```bash
npm run build
npm run preview
```

Deploy the generated `dist/` directory to a static host such as Vercel, Netlify, or Cloudflare Pages. Configure the same two `VITE_` environment variables in the hosting dashboard and set the production URL in Supabase Auth.

## Current integration boundaries

This repository contains a functional authenticated MVP and database wiring. A few advertised plan capabilities need external services and are intentionally not simulated:

- **AI Smart Spec Cleaner:** `cleaned_spec` is displayed when present, but no model provider/API is connected yet.
- **Subscriptions / Pro access:** prices are presentation only; payment checkout, subscription webhooks and entitlement management are not connected. `profiles.is_pro` should only be changed by a trusted server-side billing webhook or admin operation, never by a public client.
- **Studio team vaults:** shared membership, invitations, tenant roles and client-separated workspaces need a team-membership schema and invite flow before production release.
- **Conversation image attachments:** `image_urls` is prepared in the schema but file upload/storage UI is not yet wired.
- **Import/export integrations:** conversation capture is currently manual paste; provider-specific imports are not implemented.

Before real production use, also complete domain-specific security review, database backup/restore testing, rate limiting/abuse controls, monitoring, privacy/retention policy and automated tests.

## Repository

Target repository: <https://github.com/encryptedzee/VIBE_VAULT>

## License

No license is declared. Add a license file if you intend to make the project open source.
