import './server-only';
import type { AIProviderName } from './types';

const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_WINDOW_MS = 5 * 60 * 1000;
const USER_QUOTA_WINDOW_MS = 60 * 60 * 1000;
const DEFAULT_USER_HOURLY_QUOTA = 20;

// Process-local state is suitable for local development and one long-lived server process.
// It is not a shared quota store across Vercel/serverless instances.
const providerFailures = new Map<AIProviderName, number[]>();
const userRequests = new Map<string, number[]>();

export class AIQuotaExceededError extends Error {
  readonly code = 'user_quota_exceeded';
  readonly retryable = false;

  constructor() {
    super('The hourly AI request limit has been reached. Please try again later.');
    this.name = 'AIQuotaExceededError';
  }
}

export class AICircuitOpenError extends Error {
  readonly code = 'provider_circuit_open';
  readonly retryable = false;

  constructor() {
    super('Provider circuit is temporarily open.');
    this.name = 'AICircuitOpenError';
  }
}

function recent(values: number[], windowMs: number, now: number): number[] {
  return values.filter((time) => now - time < windowMs);
}

/** Enforces a conservative hourly quota per authenticated user in this process. */
export function reserveUserRequest(ownerId: string | null, now = Date.now()): void {
  if (!ownerId) return;
  const calls = recent(userRequests.get(ownerId) ?? [], USER_QUOTA_WINDOW_MS, now);
  const configuredLimit = Number.parseInt(process.env.AI_USER_HOURLY_QUOTA ?? '', 10);
  const limit = Number.isFinite(configuredLimit) && configuredLimit > 0
    ? Math.min(configuredLimit, 1000)
    : DEFAULT_USER_HOURLY_QUOTA;

  if (calls.length >= limit) throw new AIQuotaExceededError();
  calls.push(now);
  userRequests.set(ownerId, calls);
}

export function isProviderCircuitOpen(provider: AIProviderName, now = Date.now()): boolean {
  const failures = recent(providerFailures.get(provider) ?? [], CIRCUIT_WINDOW_MS, now);
  providerFailures.set(provider, failures);
  return failures.length >= CIRCUIT_FAILURE_THRESHOLD;
}

export function recordProviderSuccess(provider: AIProviderName): void {
  providerFailures.delete(provider);
}

export function recordProviderFailure(provider: AIProviderName, now = Date.now()): void {
  const failures = recent(providerFailures.get(provider) ?? [], CIRCUIT_WINDOW_MS, now);
  failures.push(now);
  providerFailures.set(provider, failures);
}

/** Exposed for isolated verification and controlled process-local reset. */
export function resetAIResilienceState(): void {
  providerFailures.clear();
  userRequests.clear();
}
