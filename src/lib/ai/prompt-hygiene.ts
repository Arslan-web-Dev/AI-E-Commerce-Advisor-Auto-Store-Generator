/** Shared, dependency-free helpers for safe server-side AI prompts and logs. */

const SAFE_REQUEST_ID = /^[A-Za-z0-9_.:-]{1,80}$/;
const SAFE_ERROR_CODE = /^[A-Za-z0-9_]{1,40}$/;
const URDU_SCRIPT = /[\u0600-\u06FF]/;

/** Removes control/angle-bracket characters and bounds untrusted user text. */
export function sanitizeUntrustedText(input: unknown, maxLength = 1200): string {
  const text = typeof input === 'string' ? input : input == null ? '' : String(input);
  return text
    .replace(/[\u0000-\u001F\u007F<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/**
 * Wraps user text in explicit data delimiters. Angle brackets are removed
 * first so the user cannot close the delimiter or inject a new instruction.
 */
export function delimitUntrustedText(label: string, input: unknown): string {
  const safeLabel = label.replace(/[^A-Za-z0-9_]/g, '').toUpperCase() || 'UNTRUSTED_USER_TEXT';
  return `<${safeLabel}>\n${sanitizeUntrustedText(input)}\n</${safeLabel}>`;
}

/** Keeps opaque correlation identifiers short and unable to carry prose/PII. */
export function sanitizeRequestId(input: unknown): string {
  const value = typeof input === 'string' ? input.trim() : '';
  return SAFE_REQUEST_ID.test(value) ? value : 'opaque-id';
}

/** Whitelists telemetry error codes; never accepts provider messages or raw bodies. */
export function sanitizeErrorCode(input: unknown): string {
  const value = typeof input === 'string' ? input.trim() : '';
  return SAFE_ERROR_CODE.test(value) ? value : 'provider_error';
}

/** Module 6 allows English and Roman Urdu only; Perso-Arabic script is rejected. */
export function containsUrduScript(text: string): boolean {
  return URDU_SCRIPT.test(text);
}

/**
 * Returns numeric tokens from free text. Used to reject AI summaries that
 * alter or invent numeric facts instead of copying trusted computed values.
 */
export function numericTokens(text: string): Set<string> {
  return new Set(text.match(/-?\d+(?:\.\d+)?/g) ?? []);
}

export function numbersAreGrounded(text: string, trustedFacts: unknown): boolean {
  const trusted = numericTokens(JSON.stringify(trustedFacts));
  const found = numericTokens(text);
  for (const token of found) {
    if (!trusted.has(token)) return false;
  }
  return true;
}
