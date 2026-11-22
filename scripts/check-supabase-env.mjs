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
  const message = `[VibeVault] Missing ${missing.join(', ')}. The app will show "Supabase is not connected" until these are set as Build variables.`
  // Set REQUIRE_SUPABASE=1 to make missing values fail the build.
  if (process.env.REQUIRE_SUPABASE === '1') {
    console.error(message)
    process.exit(1)
  }
  console.warn(message)
} else {
  console.log('[VibeVault] Supabase build variables detected. Values were not displayed.')
}
