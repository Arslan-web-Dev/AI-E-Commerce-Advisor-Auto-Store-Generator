import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase Admin Client using the Service Role Key.
 * MUST NEVER be imported into or executed in client components.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase admin credentials (URL or SERVICE_ROLE_KEY) are missing in environment variables.');
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
