/**
 * Shared authorization for scheduled cron route handlers.
 * Accepts Authorization: Bearer <CRON_SECRET> or x-cron-secret header.
 * Never exposes the secret in responses.
 */
export function assertCronAuthorized(request: Request): { ok: true } | { ok: false; status: number; error: string } {
  const configured = process.env.CRON_SECRET?.trim();
  if (!configured) {
    return {
      ok: false,
      status: 503,
      error: 'CRON_SECRET is not configured. Scheduled endpoints are disabled.',
    };
  }

  const authHeader = request.headers.get('authorization') || '';
  const bearer = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';
  const headerSecret = request.headers.get('x-cron-secret')?.trim() || '';
  const provided = bearer || headerSecret;

  if (!provided || provided !== configured) {
    return { ok: false, status: 401, error: 'Unauthorized cron request' };
  }

  return { ok: true };
}
