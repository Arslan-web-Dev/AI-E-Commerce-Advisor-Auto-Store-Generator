/** Shared, provider-neutral types for the server-side AI gateway. */

export type AIProviderName = 'openai' | 'gemini' | 'groq';

/** Tasks use distinct policies so that a theme request cannot inherit advisory routing. */
export type AITask = 'advisory' | 'theme' | 'product_description';

export type AILanguage = 'en' | 'ur_roman';

export interface AIUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface AIRequest {
  task: AITask;
  systemPrompt: string;
  prompt: string;
  /** Opaque identifier used for safe logging and correlation; never place PII here. */
  requestId: string;
  language?: AILanguage;
  temperature?: number;
  maxOutputTokens?: number;
  /** Provider output must be checked against the task's trusted server-side schema. */
  outputSchema?: Record<string, unknown>;
  timeoutMs?: number;
}

export interface AIProviderResult {
  content: string;
  provider: AIProviderName;
  model: string;
  usage?: AIUsage;
}

export interface AIProvider {
  readonly name: AIProviderName;
  generate(request: AIRequest, signal: AbortSignal): Promise<AIProviderResult>;
}

export interface AIAttemptLog {
  requestId: string;
  task: AITask;
  provider: AIProviderName | 'rule_fallback';
  success: boolean;
  latencyMs: number;
  /** A short, sanitized category such as "timeout" or "rate_limited". */
  errorCode?: string;
}

export interface AIGatewayResult {
  content: string;
  provider: AIProviderName | 'rule_fallback';
  model: string;
  fallback: boolean;
  attempts: AIAttemptLog[];
  usage?: AIUsage;
}

/** Provider configuration is server-only and deliberately excludes secret values. */
export interface AIProviderConfig {
  enabled: boolean;
  model: string;
}

export type AITaskPolicy = {
  providers: readonly AIProviderName[];
  timeoutMs: number;
  maxAttemptsPerProvider: number;
};
