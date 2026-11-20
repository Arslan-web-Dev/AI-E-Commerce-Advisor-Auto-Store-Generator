import '../gateway/server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AIAttemptLog } from '../gateway/types';

/**
 * Creates a best-effort writer for sanitized gateway telemetry.
 * ownerId must come from a server-verified Supabase session, never request JSON.
 */
export function createAIAttemptLogger(ownerId: string | null) {
  return async (attempt: AIAttemptLog): Promise<void> => {
    try {
      const admin = createAdminClient();
      const { error } = await admin.from('ai_call_log').insert({
        owner_id: ownerId,
        purpose: attempt.task,
        provider: attempt.provider,
        success: attempt.success,
        latency_ms: attempt.latencyMs,
        error_code: attempt.errorCode ?? null,
      });

      if (error) {
        // Do not log database error messages because they can include row data.
        console.error('AI attempt telemetry insert failed.');
      }
    } catch {
      // Telemetry must never break AI fallback or the caller's workflow.
      console.error('AI attempt telemetry could not be written.');
    }
  };
}
