import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getConfiguredProviderNames, isProviderCircuitOpen } from '@/lib/ai/gateway';
import type { AIProviderName } from '@/lib/ai/gateway';

const PROVIDER_SETTINGS: Record<AIProviderName, { keyEnv: string; modelEnv: string; defaultModel?: string }> = {
  openai: { keyEnv: 'OPENAI_API_KEY', modelEnv: 'OPENAI_MODEL', defaultModel: 'gpt-4o-mini' },
  gemini: { keyEnv: 'GEMINI_API_KEY', modelEnv: 'GEMINI_MODEL', defaultModel: 'gemini-3.8-flash' },
  groq: { keyEnv: 'GROQ_API_KEY', modelEnv: 'GROQ_MODEL' },
};

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const configured = new Set(getConfiguredProviderNames('advisory'));
  const providers = (Object.keys(PROVIDER_SETTINGS) as AIProviderName[]).map((name) => {
    const settings = PROVIDER_SETTINGS[name];
    return {
      name,
      configured: configured.has(name),
      model: process.env[settings.modelEnv]?.trim() || settings.defaultModel || null,
      circuitOpen: isProviderCircuitOpen(name),
      keyEnvName: settings.keyEnv,
    };
  });

  return NextResponse.json({ providers });
}
