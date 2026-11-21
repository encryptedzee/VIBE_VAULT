import { loadEnv } from 'vite'

// Vite exposes VITE_* values to the browser at build time. Check presence only;
// never print credentials or write them into build logs.
const env = loadEnv('production', process.cwd(), 'VITE_')
const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']
const missing = required.filter((name) => !env[name]?.trim())

console.log('[VibeVault] Supabase build configuration:')
for (const name of required) {
  console.log(`  ${name}: ${env[name]?.trim() ? 'present' : 'MISSING'}`)
}

if (missing.length) {
  console.error(`[VibeVault] Build stopped: missing ${missing.join(', ')}. Add these as Cloudflare Build variables for the Preview environment, then rebuild.`)
  process.exit(1)
}

console.log('[VibeVault] Supabase build variables detected. Values were not displayed.')
