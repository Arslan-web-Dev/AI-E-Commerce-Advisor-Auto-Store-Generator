import './server-only';
import { getProviderChain, getTaskPolicy } from './router';
import { validateAIOutput } from './validate';
import {
  isProviderCircuitOpen,
  recordProviderFailure,
  recordProviderSuccess,
  reserveUserRequest,
} from './resilience';
import { cacheAIResponse, getCachedAIResponse } from '../cache/response-cache';
import type {
  AIAttemptLog,
  AIGatewayResult,
  AIProvider,
  AIProviderName,
  AIRequest,
} from './types';

type ProviderFailure = Error & {
  code?: string;
  retryable?: boolean;
};

export interface ExecuteAIGatewayOptions {
  /** Required deterministic, task-specific fallback; must not call an external provider. */
  fallback: () => string | Promise<string>;
  signal?: AbortSignal;
  /** Must be a user ID read from the authenticated server session, never request JSON. */
  ownerId?: string | null;
  /** Receives sanitized telemetry only. Logger failures never prevent fallback or routing. */
  onAttempt?: (attempt: AIAttemptLog) => void | Promise<void>;
}

function safeErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as ProviderFailure).code;
    if (typeof code === 'string' && /^[a-z0-9_]{1,40}$/i.test(code)) return code;
  }
  if (error instanceof Error && /abort|timeout/i.test(error.name + error.message)) return 'timeout';
  return 'provider_error';
}

function isRetryable(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'retryable' in error && (error as ProviderFailure).retryable);
}

function createAttemptSignal(parent: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
  const abortParent = () => controller.abort(parent?.reason);
  if (parent?.aborted) abortParent();
  else parent?.addEventListener('abort', abortParent, { once: true });

  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timer);
      parent?.removeEventListener('abort', abortParent);
    },
  };
}

async function reportAttempt(
  attempt: AIAttemptLog,
  attempts: AIAttemptLog[],
  onAttempt?: ExecuteAIGatewayOptions['onAttempt'],
) {
  attempts.push(attempt);
  try {
    await onAttempt?.(attempt);
  } catch {
    // Observability is best effort and cannot block user-facing fallback behavior.
  }
}

/** Runs providers in task policy order and returns deterministic fallback after exhaustion. */
export async function executeAIGateway(
  request: AIRequest,
  options: ExecuteAIGatewayOptions,
): Promise<AIGatewayResult> {
  const policy = getTaskPolicy(request.task);
  const providers = getProviderChain(request.task);
  const attempts: AIAttemptLog[] = [];
  const timeoutMs = request.timeoutMs ?? policy.timeoutMs;
  const cached = getCachedAIResponse(request, options.ownerId ?? null);
  if (cached) return cached;
  reserveUserRequest(options.ownerId ?? null);

  for (const provider of providers) {
    if (isProviderCircuitOpen(provider.name)) {
      await reportAttempt({
        requestId: request.requestId,
        task: request.task,
        provider: provider.name,
        success: false,
        latencyMs: 0,
        errorCode: 'provider_circuit_open',
      }, attempts, options.onAttempt);
      continue;
    }

    for (let attemptNumber = 1; attemptNumber <= policy.maxAttemptsPerProvider; attemptNumber += 1) {
      if (options.signal?.aborted) break;

      const startedAt = Date.now();
      const timed = createAttemptSignal(options.signal, timeoutMs);
      try {
        const result = await provider.generate(request, timed.signal);
        const validatedContent = validateAIOutput(result.content, request.outputSchema);
        recordProviderSuccess(provider.name);
        await reportAttempt({
          requestId: request.requestId,
          task: request.task,
          provider: provider.name,
          success: true,
          latencyMs: Math.max(0, Date.now() - startedAt),
        }, attempts, options.onAttempt);

        const gatewayResult = { ...result, content: validatedContent, fallback: false, attempts };
        cacheAIResponse(request, options.ownerId ?? null, gatewayResult);
        return gatewayResult;
      } catch (error) {
        recordProviderFailure(provider.name);
        await reportAttempt({
          requestId: request.requestId,
          task: request.task,
          provider: provider.name,
          success: false,
          latencyMs: Math.max(0, Date.now() - startedAt),
          errorCode: safeErrorCode(error),
        }, attempts, options.onAttempt);

        if (options.signal?.aborted) break;
        if (attemptNumber >= policy.maxAttemptsPerProvider || !isRetryable(error)) break;
      } finally {
        timed.cleanup();
      }
    }
  }

  const content = (await options.fallback()).trim();
  await reportAttempt({
    requestId: request.requestId,
    task: request.task,
    provider: 'rule_fallback',
    success: true,
    latencyMs: 0,
  }, attempts, options.onAttempt);

  return {
    content,
    provider: 'rule_fallback',
    model: 'deterministic',
    fallback: true,
    attempts,
  };
}

/** Exposes the actual order for diagnostics without exposing provider configuration values. */
export function getProviderOrderForTask(task: AIRequest['task']): AIProviderName[] {
  return getProviderChain(task).map((provider: AIProvider) => provider.name);
}
