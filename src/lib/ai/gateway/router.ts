import './server-only';
import type { AIProvider, AIProviderName, AITask, AITaskPolicy } from './types';
import { geminiProvider } from '../providers/gemini';
import { groqProvider } from '../providers/groq';
import { openAIProvider } from '../providers/openai';

const PROVIDERS: Record<AIProviderName, AIProvider> = {
  openai: openAIProvider,
  gemini: geminiProvider,
  groq: groqProvider,
};

const PROVIDER_NAMES: readonly AIProviderName[] = ['openai', 'gemini', 'groq'];

/**
 * Server-owned defaults. A client can never pass a provider, task policy or
 * owner id through the advisory API; only this module resolves routing.
 */
const TASK_POLICIES: Record<AITask, AITaskPolicy> = {
  advisory: {
    providers: ['openai', 'gemini', 'groq'],
    timeoutMs: 20_000,
    maxAttemptsPerProvider: 1,
  },
  theme: {
    providers: ['groq'],
    timeoutMs: 20_000,
    maxAttemptsPerProvider: 2,
  },
  product_description: {
    providers: ['groq', 'openai', 'gemini'],
    timeoutMs: 20_000,
    maxAttemptsPerProvider: 1,
  },
};

const PROVIDER_ORDER_ENV: Partial<Record<AITask, string>> = {
  advisory: 'AI_ADVISORY_PROVIDERS',
};

function parseProviderOverride(task: AITask): readonly AIProviderName[] | null {
  const envName = PROVIDER_ORDER_ENV[task];
  if (!envName) return null;
  const raw = process.env[envName]?.trim();
  if (!raw) return null;

  const requested = raw.split(',').map((name) => name.trim().toLowerCase());
  const valid = requested.every((name) =>
    PROVIDER_NAMES.includes(name as AIProviderName),
  );
  if (!valid || requested.length === 0) return null;

  return [...new Set(requested)] as AIProviderName[];
}

function isProviderConfigured(name: AIProviderName): boolean {
  const hasApiKey = Boolean(process.env[`${name.toUpperCase()}_API_KEY`]?.trim());
  const hasModel = Boolean(process.env[`${name.toUpperCase()}_MODEL`]?.trim());
  return hasApiKey && hasModel;
}

/** Returns a server-resolved copy of a task policy; never exposes credentials. */
export function getTaskPolicy(task: AITask): AITaskPolicy {
  const fallback = TASK_POLICIES[task];
  const override = parseProviderOverride(task);
  return {
    providers: override ? [...override] : [...fallback.providers],
    timeoutMs: fallback.timeoutMs,
    maxAttemptsPerProvider: fallback.maxAttemptsPerProvider,
  };
}

export function getProviderChain(task: AITask): AIProvider[] {
  return getTaskPolicy(task)
    .providers.filter(isProviderConfigured)
    .map((name) => PROVIDERS[name]);
}

export function getConfiguredProviderNames(task: AITask): AIProviderName[] {
  return getProviderChain(task).map((provider) => provider.name);
}
