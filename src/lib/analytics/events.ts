/**
 * Module 9: Event Ingestion & Privacy Guards
 * Handles telemetry validation, rate limiting, and pseudonymous hashing.
 */

import { AnalyticsEventType } from '@/types/analytics';

const ALLOWED_EVENT_TYPES: Set<AnalyticsEventType> = new Set([
  'page_view',
  'product_view',
  'add_to_cart',
  'remove_from_cart',
  'begin_checkout',
  'purchase',
]);

export interface IngestEventPayload {
  store_id: string;
  event_type: string;
  session_id: string;
  product_id?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  metadata?: Record<string, unknown>;
}

export function validateEventPayload(payload: unknown): {
  valid: boolean;
  error?: string;
  sanitized?: IngestEventPayload;
} {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Event payload must be a JSON object' };
  }

  const p = payload as Record<string, unknown>;

  if (typeof p.store_id !== 'string' || !p.store_id.trim()) {
    return { valid: false, error: 'store_id is required and must be a string' };
  }

  if (typeof p.event_type !== 'string' || !ALLOWED_EVENT_TYPES.has(p.event_type as AnalyticsEventType)) {
    return {
      valid: false,
      error: `Invalid event_type. Allowed types: ${Array.from(ALLOWED_EVENT_TYPES).join(', ')}`,
    };
  }

  if (typeof p.session_id !== 'string' || !p.session_id.trim()) {
    return { valid: false, error: 'session_id is required' };
  }

  // Sanitize strings and truncate bounded lengths to prevent DOS or injection
  const sanitized: IngestEventPayload = {
    store_id: p.store_id.trim(),
    event_type: p.event_type.trim(),
    session_id: String(p.session_id).slice(0, 128).trim(),
    product_id: typeof p.product_id === 'string' ? p.product_id.trim() : undefined,
    referrer: typeof p.referrer === 'string' ? p.referrer.slice(0, 500).trim() : undefined,
    utm_source: typeof p.utm_source === 'string' ? p.utm_source.slice(0, 100).trim() : undefined,
    utm_medium: typeof p.utm_medium === 'string' ? p.utm_medium.slice(0, 100).trim() : undefined,
    utm_campaign: typeof p.utm_campaign === 'string' ? p.utm_campaign.slice(0, 100).trim() : undefined,
    metadata:
      p.metadata && typeof p.metadata === 'object' && !Array.isArray(p.metadata)
        ? (p.metadata as Record<string, unknown>)
        : {},
  };

  return { valid: true, sanitized };
}
