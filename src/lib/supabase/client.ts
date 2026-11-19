import { createBrowserClient } from '@supabase/ssr';

function isValidHttpUrl(str?: string): boolean {
  if (!str) return false;
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function getBrowserSupabaseConfigError(): string | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabasePublicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabasePublicKey) {
    return 'Authentication is not configured for this deployment. Add the Supabase URL and public API key to the deployment environment.';
  }

  if (
    !isValidHttpUrl(supabaseUrl) ||
    supabaseUrl.includes('your-project-ref') ||
    supabaseUrl.includes('placeholder.supabase.co') ||
    supabasePublicKey === 'your-anon-key-here' ||
    supabasePublicKey === 'your-publishable-key-here' ||
    supabasePublicKey.includes('.placeholder')
  ) {
    return 'The Supabase URL or public anon key is still a placeholder. Check the deployment environment settings.';
  }

  return null;
}

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // During static generation (build), env vars may be absent or invalid.
  // Return a dummy client that will be replaced at runtime.
  if (getBrowserSupabaseConfigError()) {
    return createBrowserClient(
      'https://placeholder.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder'
    );
  }

  return createBrowserClient(supabaseUrl!, supabasePublicKey!);
}
