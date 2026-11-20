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

function isProviderConfigured(name: AIProviderName): boolean {
  switch (name) {
    case 'openai':
      return Boolean(process.env.OPENAI_API_KEY?.trim());
    case 'gemini':
      return Boolean(process.env.GEMINI_API_KEY?.trim());
    case 'groq':
      return Boolean(process.env.GROQ_API_KEY?.trim() && process.env.GROQ_MODEL?.trim());
  }
}

/** Returns only configured providers, retaining the task's required order. */
export function getProviderChain(task: AITask): AIProvider[] {
  return TASK_POLICIES[task].providers
    .filter(isProviderConfigured)
    .map((name) => PROVIDERS[name]);
}

export function getTaskPolicy(task: AITask): AITaskPolicy {
  return TASK_POLICIES[task];
}

/** Exposes provider names only; never returns credential values. */
export function getConfiguredProviderNames(task: AITask): AIProviderName[] {
  return TASK_POLICIES[task].providers.filter(isProviderConfigured);
}
