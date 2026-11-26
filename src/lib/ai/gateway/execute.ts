import './server-only';
import { getProviderChain, getTaskPolicy } from './router';
import { validateAIOutput } from './validate';
import {
  AIQuotaExceededError,
  isProviderCircuitOpen,
  recordProviderFailure,
  recordProviderSuccess,
  reserveUserRequest,
} from './resilience';
import { cacheAIResponse, getCachedAIResponse } from '../cache/response-cache';
import { sanitizeErrorCode, sanitizeRequestId } from '../prompt-hygiene';
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
  /** Optional semantic check after schema validation; throwing counts as provider failure. */
  validateOutput?: (content: string) => void;
}

function safeErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as ProviderFailure).code;
    if (typeof code === 'string' && sanitizeErrorCode(code) === code) return code;
  }
  if (error instanceof Error && /abort|timeout/i.test(error.name + error.message)) return 'timeout';
  return 'provider_error';
}

function isRetryable(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'retryable' in error && (error as ProviderFailure).retryable);
}

function normalizeTimeoutMs(value: number | undefined, fallbackMs: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallbackMs;
  return Math.min(120_000, Math.max(1, Math.floor(value)));
}

/** Module 6 accepts exactly two languages; a runtime guard covers untyped callers. */
function assertSupportedRequest(request: AIRequest): void {
  if (request.language !== undefined && !['en', 'ur_roman'].includes(request.language)) {
    throw new Error('Unsupported AI language.');
  }
  if (!request.systemPrompt?.trim() || !request.prompt?.trim()) {
    throw new Error('AI prompt must not be empty.');
  }
}

function createAttemptSignal(parent: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutError: ProviderFailure = new Error('AI attempt timed out.');
  timeoutError.code = 'timeout';
  timeoutError.retryable = true;
  let timedOut = false;

  const timeoutPromise = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort(timeoutError);
      reject(timeoutError);
    }, timeoutMs);
    controller.signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
  });

  const abortParent = () => controller.abort(parent?.reason);
  if (parent?.aborted) abortParent();
  else parent?.addEventListener('abort', abortParent, { once: true });

  return {
    signal: controller.signal,
    timeoutPromise,
    isTimedOut: () => timedOut,
    cleanup() {
      controller.abort();
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

async function deterministicResult(
  request: AIRequest,
  options: ExecuteAIGatewayOptions,
  attempts: AIAttemptLog[],
  requestId: string,
  fallbackErrorCode?: string,
): Promise<AIGatewayResult> {
  const content = (await options.fallback()).trim();
  await reportAttempt({
    requestId,
    task: request.task,
    provider: 'rule_fallback',
    success: true,
    latencyMs: 0,
    ...(fallbackErrorCode ? { errorCode: sanitizeErrorCode(fallbackErrorCode) } : {}),
  }, attempts, options.onAttempt);

  return {
    content,
    provider: 'rule_fallback',
    model: 'deterministic',
    fallback: true,
    attempts,
  };
}

/** Runs providers in task policy order and returns deterministic fallback after exhaustion. */
export async function executeAIGateway(
  request: AIRequest,
  options: ExecuteAIGatewayOptions,
): Promise<AIGatewayResult> {
  assertSupportedRequest(request);
  const policy = getTaskPolicy(request.task);
  const providers = getProviderChain(request.task);
  const attempts: AIAttemptLog[] = [];
  const requestId = sanitizeRequestId(request.requestId);
  const timeoutMs = normalizeTimeoutMs(request.timeoutMs ?? policy.timeoutMs, policy.timeoutMs);

  const cached = getCachedAIResponse(request, options.ownerId ?? null);
  if (cached) return cached;

  try {
    reserveUserRequest(options.ownerId ?? null);
  } catch (error) {
    if (error instanceof AIQuotaExceededError) {
      // A quota limit must degrade to deterministic advice, never an error page.
      return deterministicResult(request, options, attempts, requestId, error.code);
    }
    throw error;
  }

  if (options.signal?.aborted) {
    throw new Error('AI request was cancelled before provider selection.');
  }

  for (const provider of providers) {
    if (isProviderCircuitOpen(provider.name)) {
      await reportAttempt({
        requestId,
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
        const result = await Promise.race([
          provider.generate(request, timed.signal),
          timed.timeoutPromise,
        ]);
        const validatedContent = validateAIOutput(result.content, request.outputSchema);
        options.validateOutput?.(validatedContent);
        recordProviderSuccess(provider.name);
        await reportAttempt({
          requestId,
          task: request.task,
          provider: provider.name,
          success: true,
          latencyMs: Math.max(0, Date.now() - startedAt),
        }, attempts, options.onAttempt);

        const gatewayResult: AIGatewayResult = {
          ...result,
          content: validatedContent,
          fallback: false,
          attempts,
        };
        cacheAIResponse(request, options.ownerId ?? null, gatewayResult);
        return gatewayResult;
      } catch (error) {
        const effectiveError = timed.isTimedOut()
          ? Object.assign(new Error('AI attempt timed out.'), { code: 'timeout', retryable: true })
          : error;
        recordProviderFailure(provider.name);
        await reportAttempt({
          requestId,
          task: request.task,
          provider: provider.name,
          success: false,
          latencyMs: Math.max(0, Date.now() - startedAt),
          errorCode: safeErrorCode(effectiveError),
        }, attempts, options.onAttempt);

        if (options.signal?.aborted) break;
        if (attemptNumber >= policy.maxAttemptsPerProvider || !isRetryable(effectiveError)) break;
      } finally {
        timed.cleanup();
      }
    }
  }

  if (options.signal?.aborted) {
    throw new Error('AI request was cancelled before fallback.');
  }

  return deterministicResult(request, options, attempts, requestId);
}

/** Exposes the actual order for diagnostics without exposing provider configuration values. */
export function getProviderOrderForTask(task: AIRequest['task']): AIProviderName[] {
  return getProviderChain(task).map((provider: AIProvider) => provider.name);
}
