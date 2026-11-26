import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authorizationFailure, canManageStore } from '@/lib/store-management/authorization';
import {
  DOMAIN_STATUS,
  addProjectDomain,
  domainStateFromProvider,
  getProjectDomain,
  normalizeStoreDomain,
  removeProjectDomain,
  vercelConfigFromEnv,
  verifyProjectDomain,
  type DomainStatus,
} from '@/lib/store-management/domains';

export const dynamic = 'force-dynamic';

type DomainAction = 'add' | 'verify' | 'remove' | 'status';

const DOMAIN_COLUMNS = [
  'id', 'owner_id', 'slug', 'status', 'custom_domain', 'domain_status',
  'domain_verification_token', 'domain_challenges', 'domain_verified_at',
  'domain_attached_at', 'domain_provider_reference', 'domain_last_error',
].join(', ');

function parseAction(body: unknown): { action: DomainAction; domain: string | null } | null {
  if (!body || typeof body !== 'object') return null;
  const payload = body as Record<string, unknown>;
  const raw = typeof payload.action === 'string'
    ? payload.action
    : payload.verify === true
      ? 'verify'
      : payload.custom_domain
        ? 'add'
        : 'status';
  if (!['add', 'verify', 'remove', 'status'].includes(raw)) return null;
  return {
    action: raw as DomainAction,
    domain: normalizeStoreDomain(payload.domain ?? payload.custom_domain),
  };
}

async function readStore(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data, error } = await supabase.from('stores').select(DOMAIN_COLUMNS).eq('id', id).maybeSingle();
  return { store: data, error };
}

function domainResponse(store: Record<string, unknown>, providerError?: string) {
  const status = (store.domain_status as DomainStatus | null) ?? DOMAIN_STATUS.NOT_CONFIGURED;
  const challenges = Array.isArray(store.domain_challenges) ? store.domain_challenges : [];
  return {
    custom_domain: store.custom_domain ?? null,
    status,
    verified: status === DOMAIN_STATUS.VERIFIED,
    verification_token: store.domain_verification_token ?? null,
    dns_records: challenges,
    domain_verified_at: store.domain_verified_at ?? null,
    ...(providerError ? { provider_error: providerError } : {}),
  };
}

async function requireManager(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { failure: authorizationFailure('unauthorized') };
  const { store, error } = await readStore(supabase, id);
  if (error || !store) return { failure: authorizationFailure('not_found') };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const ownership = store as unknown as { owner_id: string };
  if (!canManageStore(user, ownership, profile as { role?: string | null } | null)) {
    return { failure: authorizationFailure('forbidden') };
  }
  return { user, store: store as unknown as Record<string, unknown> };
}

function persistDomainState(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  domain: string | null,
  state: ReturnType<typeof domainStateFromProvider>,
  providerReference: string | null,
  providerError: string | null,
) {
  return supabase.from('stores').update({
    ...(domain !== null ? { custom_domain: domain } : {}),
    domain_status: state.status,
    domain_verification_token: state.verificationToken,
    domain_challenges: state.challenges,
    ...(state.verifiedAt ? { domain_verified_at: state.verifiedAt } : {}),
    ...(providerReference ? { domain_provider_reference: providerReference } : {}),
    domain_last_error: providerError,
  }).eq('id', id);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const auth = await requireManager(supabase, id);
  if (auth.failure) {
    return NextResponse.json({ error: auth.failure.error }, { status: auth.failure.status });
  }

  const domain = auth.store.custom_domain ? normalizeStoreDomain(auth.store.custom_domain) : null;
  const config = vercelConfigFromEnv();
  if (!domain || !config) {
    return NextResponse.json(domainResponse(auth.store));
  }

  const provider = await getProjectDomain(fetch, config, domain);
  if (!provider.ok || !provider.record) {
    await persistDomainState(supabase, id, domain, domainStateFromProvider(undefined), null, provider.error ?? null);
    const updated = { ...auth.store, domain_status: DOMAIN_STATUS.PROVIDER_UNAVAILABLE };
    return NextResponse.json(domainResponse(updated, provider.error), { status: 502 });
  }

  const state = domainStateFromProvider(provider.record);
  const { error } = await persistDomainState(supabase, id, domain, state, provider.record.projectId ?? null, null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(domainResponse({ ...auth.store, ...state, custom_domain: domain }));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const auth = await requireManager(supabase, id);
  if (auth.failure) {
    return NextResponse.json({ error: auth.failure.error }, { status: auth.failure.status });
  }

  const parsed = parseAction(await req.json().catch(() => null));
  if (!parsed) return NextResponse.json({ error: 'Invalid domain action.' }, { status: 400 });
  const config = vercelConfigFromEnv();
  if (!config) {
    return NextResponse.json(
      { error: 'Custom domains are unavailable: VERCEL_TOKEN and VERCEL_PROJECT_ID must be configured.' },
      { status: 503 },
    );
  }

  if (parsed.action === 'status') return GET(req, { params: Promise.resolve({ id }) });

  const currentDomain = auth.store.custom_domain ? normalizeStoreDomain(auth.store.custom_domain) : null;
  const domain = parsed.domain ?? currentDomain;
  if (!domain) return NextResponse.json({ error: 'Provide a valid custom domain.' }, { status: 400 });
  if (currentDomain && currentDomain !== domain && parsed.action !== 'add') {
    return NextResponse.json({ error: 'The supplied domain does not match the configured domain.' }, { status: 400 });
  }

  if (parsed.action === 'remove') {
    if (!currentDomain) return NextResponse.json(domainResponse(auth.store));
    const removed = await removeProjectDomain(fetch, config, currentDomain);
    if (!removed.ok) {
      return NextResponse.json({ error: removed.error ?? 'Domain removal failed.' }, { status: 502 });
    }
    const clear = await supabase.from('stores').update({
      custom_domain: null,
      domain_status: DOMAIN_STATUS.NOT_CONFIGURED,
      domain_verification_token: null,
      domain_challenges: [],
      domain_verified_at: null,
      domain_attached_at: null,
      domain_provider_reference: null,
      domain_last_error: null,
    }).eq('id', id);
    if (clear.error) return NextResponse.json({ error: clear.error.message }, { status: 500 });
    return NextResponse.json({ success: true, ...domainResponse({ ...auth.store, custom_domain: null, domain_status: DOMAIN_STATUS.NOT_CONFIGURED }) });
  }

  const provider = parsed.action === 'add'
    ? await addProjectDomain(fetch, config, domain)
    : await verifyProjectDomain(fetch, config, domain);

  if (!provider.ok) {
    await persistDomainState(supabase, id, currentDomain, domainStateFromProvider(undefined), null, provider.error ?? null);
    return NextResponse.json({ error: provider.error ?? 'Provider request failed.' }, { status: 502 });
  }

  const state = domainStateFromProvider(provider.record);
  const { error } = await persistDomainState(
    supabase,
    id,
    domain,
    state,
    provider.record?.projectId ?? null,
    null,
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const attached = await supabase.from('stores').update({
    domain_attached_at: new Date().toISOString(),
  }).eq('id', id).eq('domain_attached_at', null);
  if (attached.error) return NextResponse.json({ error: attached.error.message }, { status: 500 });

  return NextResponse.json({
    success: true,
    action: parsed.action,
    ...domainResponse({ ...auth.store, custom_domain: domain, ...state }),
  });
}
