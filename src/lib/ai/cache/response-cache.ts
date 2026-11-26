import '../gateway/server-only';
import { createHash } from 'node:crypto';
import type { AIGatewayResult, AIRequest } from '../gateway/types';

const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const cache = new Map<string, { expiresAt: number; result: AIGatewayResult }>();

/**
 * Model identifiers are part of the key so changing provider configuration can
 * never serve stale text produced by a retired model.
 */
function modelSignature(): string {
  return JSON.stringify({
    openai: process.env.OPENAI_MODEL?.trim() || '',
    gemini: process.env.GEMINI_MODEL?.trim() || '',
    groq: process.env.GROQ_MODEL?.trim() || '',
  });
}

function cacheKey(request: AIRequest, ownerId: string): string {
  const version = process.env.AI_PROMPT_VERSION?.trim() || 'v1';
  return createHash('sha256')
    .update(JSON.stringify({
      ownerId,
      task: request.task,
      language: request.language ?? 'en',
      version,
      models: modelSignature(),
      systemPrompt: request.systemPrompt,
      prompt: request.prompt,
      outputSchema: request.outputSchema ?? null,
      temperature: request.temperature ?? null,
      maxOutputTokens: request.maxOutputTokens ?? null,
    }))
    .digest('hex');
}

export function getCachedAIResponse(request: AIRequest, ownerId: string | null): AIGatewayResult | null {
  if (!ownerId) return null;
  const key = cacheKey(request, ownerId);
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return { ...entry.result, attempts: [] };
}

export function cacheAIResponse(
  request: AIRequest,
  ownerId: string | null,
  result: AIGatewayResult,
): void {
  if (!ownerId || result.fallback || result.provider === 'rule_fallback') return;
  const key = cacheKey(request, ownerId);
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    result: { ...result, attempts: [] },
  });
}

/** Test/admin reset hook. The cache is process-local, not a durable shared cache. */
export function clearAIResponseCache(): void {
  cache.clear();
}
