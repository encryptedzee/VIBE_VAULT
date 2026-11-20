# VibeVault

**GitHub for your AI brain and dynamic `AGENT.md` handoffs.** A React + Vite + Supabase application using the GAMER Control-Room design system.

## Included

- VibeVault branding with the VV monogram and a responsive public landing page.
- Email/password authentication and GitHub OAuth through Supabase Auth.
- Three-panel control room for projects, raw conversation archive, and the `AGENT.md` handoff engine.
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
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in your local `.env`.
4. In **Authentication → Providers**, enable Email and GitHub. Configure the GitHub OAuth app with the callback URL displayed by Supabase.
5. In **Authentication → URL Configuration**, set your site URL and add local and production origins to the allowed redirect URLs. GitHub OAuth redirects back to `window.location.origin`.
6. Restart Vite after changing environment values.

Do not grant browser clients permission to update `profiles.is_pro`. The schema restricts profile updates to non-entitlement fields. Set Pro entitlements only from a trusted payment webhook or a secured administrative process.

## AI Smart Spec Cleaner

The Pro UI calls the Supabase Edge Function:

```js
supabase.functions.invoke('clean-spec', {
  body: { raw_content, conversation_id }
})
```

The function must authenticate the caller, verify ownership of `conversation_id`, and return JSON containing `cleaned_spec` (a string). The client persists that result to the same conversation row. Keep the raw source immutable; the cleaner should never overwrite `raw_content`.

Deploy and configure the `clean-spec` Edge Function and its model-provider secrets separately. This repository invokes the function but does not include a model provider key or a deployed Edge Function implementation.

## Billing and entitlement lifecycle

The checkout modal opens the configured hosted checkout URL with `customer_email`. Tanzania customers can use the displayed Lipa Namba and must include their VibeVault account email in the payment reference. These front-end steps do not independently verify payment.

To activate Pro reliably, implement a trusted Polar/payment-provider webhook that verifies payment signatures, maps the checkout customer to the VibeVault user, and updates `profiles.is_pro` server-side. Founder Lifetime should grant the same Pro entitlement permanently. The **REFRESH PLAN STATUS** control re-reads the current profile flag; it does not itself verify or process a payment.

## Build and deploy

```bash
npm run build
npm run preview
```

Deploy the generated `dist/` directory to Vercel, Netlify, Cloudflare Pages, or another static host. Configure all six `VITE_` variables in the host environment and set the production origin in Supabase Auth.

Before production launch, complete the Edge Function, verified billing webhooks, payment reconciliation, monitoring, backups, privacy/retention policy, and automated security and end-to-end tests.

## Repository

https://github.com/encryptedzee/VIBE_VAULT
