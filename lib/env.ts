// Centralized env access with the NEXT_PUBLIC_ fallbacks.
// SUPABASE_URL / SUPABASE_ANON_KEY are the canonical names; Next.js only
// inlines NEXT_PUBLIC_* into browser bundles, so public mirrors exist.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  "";
