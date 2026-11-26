/**
 * FR-5.6: bounded, honest competitor page loading.
 *
 * The feasibility page previously fired every remaining page at once. This
 * helper fetches page 1, validates the server's pagination contract, then
 * loads later pages with a small worker pool. Every page failure is recorded
 * rather than aborting the dashboard or being misreported as complete data.
 */
export const DEFAULT_COMPETITOR_CONCURRENCY = 3;
export const MAX_COMPETITOR_PAGES = 100;

export interface CompetitorPagePagination {
  page?: number | null;
  limit?: number | null;
  total?: number | null;
  total_pages?: number | null;
}

export interface CompetitorPagePayload<T> {
  competitors?: T[] | null;
  pagination?: CompetitorPagePagination | null;
}

export type FetchCompetitorPage<T> = (page: number) => Promise<CompetitorPagePayload<T>>;

export interface CompetitorPageFailure {
  page: number;
  reason: string;
}

export interface CompetitorIdentityFields {
  id?: string | number | null;
  provider?: string | null;
  name?: string | null;
  lat?: number | number[] | null;
  lng?: number | number[] | null;
  raw_data?: Record<string, unknown> | null;
}

export interface CompetitorLoadResult<T> {
  competitors: T[];
  /** Unique records successfully loaded after stable deduplication. */
  loadedCount: number;
  /** Rows received from storage before deduplication. */
  loadedRowCount: number;
  /** `pagination.total` from the server, or null when it is missing/invalid. */
  serverTotal: number | null;
  totalPages: number;
  successfulPages: number[];
  failedPages: CompetitorPageFailure[];
  duplicateCount: number;
  maxObservedConcurrency: number;
  invalidTotalPages: boolean;
  cappedTotalPages: boolean;
  complete: boolean;
  partial: boolean;
  notes: string[];
}

export interface CompetitorLoadOptions {
  concurrency?: number;
  maxPages?: number;
}

interface TotalPagesInfo {
  totalPages: number;
  invalid: boolean;
  capped: boolean;
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Validate before trusting any server-supplied page count. */
export function parseCompetitorTotalPages(value: unknown, maxPages = MAX_COMPETITOR_PAGES): TotalPagesInfo {
  const upperBound = Number.isInteger(maxPages) && maxPages > 0 ? maxPages : MAX_COMPETITOR_PAGES;
  const numeric = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;

  if (!Number.isFinite(numeric) || numeric < 0 || !Number.isInteger(numeric)) {
    return { totalPages: 1, invalid: true, capped: false };
  }
  if (numeric > upperBound) {
    return { totalPages: upperBound, invalid: false, capped: true };
  }
  return { totalPages: Math.max(1, numeric), invalid: false, capped: false };
}

function parseServerTotal(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
  return Number.isFinite(numeric) && Number.isInteger(numeric) && numeric >= 0 ? numeric : null;
}

function normalizeConcurrency(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 10
    ? value
    : DEFAULT_COMPETITOR_CONCURRENCY;
}

function rawIdentity(row: CompetitorIdentityFields): string | null {
  const raw = row.raw_data;
  if (raw && typeof raw === 'object') {
    const osmIdentity = raw.osm_identity;
    if (clean(osmIdentity)) return `osm:${clean(osmIdentity).toLowerCase()}`;
    const osmType = raw.osm_type;
    const osmId = raw.osm_id;
    if ((typeof osmType === 'string' || typeof osmType === 'number') && (typeof osmId === 'string' || typeof osmId === 'number')) {
      return `osm:${String(osmType).toLowerCase()}/${String(osmId)}`;
    }
  }
  if (row.id != null && clean(String(row.id))) return `id:${clean(String(row.id))}`;
  // No name-only dedupe: two distinct businesses may share a name.
  const provider = clean(row.provider);
  const name = clean(row.name);
  if (provider && name && typeof row.lat === 'number' && typeof row.lng === 'number') {
    return `provider:${provider.toLowerCase()}|${name.toLowerCase()}|${row.lat},${row.lng}`;
  }
  return null;
}

export function competitorIdentityKey(row: CompetitorIdentityFields): string | null {
  return rawIdentity(row);
}

export function dedupeCompetitors<T extends CompetitorIdentityFields>(rows: T[]): { rows: T[]; duplicateCount: number } {
  const seen = new Set<string>();
  const unique: T[] = [];
  let duplicateCount = 0;
  for (const row of rows) {
    const key = rawIdentity(row);
    if (key && seen.has(key)) {
      duplicateCount += 1;
      continue;
    }
    if (key) seen.add(key);
    unique.push(row);
  }
  return { rows: unique, duplicateCount };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Fetch all competitor pages without unbounded concurrency. */
export async function loadCompetitorPages<T extends CompetitorIdentityFields>(
  fetchPage: FetchCompetitorPage<T>,
  options?: CompetitorLoadOptions
): Promise<CompetitorLoadResult<T>> {
  const concurrency = normalizeConcurrency(options?.concurrency);
  const notes: string[] = [];
  const firstPayload = await (async () => {
    try {
      const payload = await fetchPage(1);
      if (!payload || !Array.isArray(payload.competitors)) {
        throw new Error('Competitor page 1 returned no competitor array.');
      }
      return payload;
    } catch (err: unknown) {
      notes.push(`Competitor page 1 failed: ${errorMessage(err)}`);
      return null;
    }
  })();

  if (!firstPayload) {
    return {
      competitors: [],
      loadedCount: 0,
      loadedRowCount: 0,
      serverTotal: null,
      totalPages: 1,
      successfulPages: [],
      failedPages: [{ page: 1, reason: notes[0] ?? 'Page 1 failed.' }],
      duplicateCount: 0,
      maxObservedConcurrency: 0,
      invalidTotalPages: false,
      cappedTotalPages: false,
      complete: false,
      partial: true,
      notes,
    };
  }

  const pages = parseCompetitorTotalPages(firstPayload.pagination?.total_pages, options?.maxPages);
  const serverTotal = parseServerTotal(firstPayload.pagination?.total);
  if (pages.invalid) notes.push('The server total_pages value was invalid; only page 1 was used.');
  if (pages.capped) notes.push(`The server total_pages value exceeded the safe cap of ${pages.totalPages}; later pages were not loaded.`);
  if (serverTotal === null) notes.push('The server competitor total was missing or invalid.');

  const payloads: (CompetitorPagePayload<T> | null)[] = new Array(pages.totalPages).fill(null);
  payloads[0] = firstPayload;
  const successfulPages: number[] = [1];
  const failedPages: CompetitorPageFailure[] = [];
  let cursor = 2;
  let active = 0;
  let maxObservedConcurrency = 0;

  async function fetchOne(page: number): Promise<void> {
    active += 1;
    maxObservedConcurrency = Math.max(maxObservedConcurrency, active);
    try {
      const payload = await fetchPage(page);
      if (!payload || !Array.isArray(payload.competitors)) {
        throw new Error('Page returned no competitor array.');
      }
      payloads[page - 1] = payload;
      successfulPages.push(page);
    } catch (err: unknown) {
      failedPages.push({ page, reason: errorMessage(err) });
      notes.push(`Competitor page ${page} failed: ${errorMessage(err)}`);
    } finally {
      active -= 1;
    }
  }

  async function worker(): Promise<void> {
    while (cursor <= pages.totalPages) {
      const page = cursor;
      cursor += 1;
      await fetchOne(page);
    }
  }

  const workerCount = Math.min(concurrency, Math.max(0, pages.totalPages - 1));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  successfulPages.sort((a, b) => a - b);
  failedPages.sort((a, b) => a.page - b.page);

  const rawRows = payloads.flatMap((payload) => {
    const competitors = payload?.competitors;
    return Array.isArray(competitors) ? competitors : [];
  });
  const { rows, duplicateCount } = dedupeCompetitors(rawRows);
  if (duplicateCount > 0) notes.push(`${duplicateCount} duplicate competitor record(s) were removed by stable identifier.`);

  const allExpectedPagesLoaded = successfulPages.length + failedPages.length === pages.totalPages;
  const totalConfirmed = serverTotal !== null && rawRows.length >= serverTotal;
  const complete =
    failedPages.length === 0 &&
    !pages.invalid &&
    !pages.capped &&
    allExpectedPagesLoaded &&
    serverTotal !== null &&
    totalConfirmed;
  if (!complete && failedPages.length === 0 && serverTotal !== null && !totalConfirmed) {
    notes.push(`Only ${rawRows.length} competitor row(s) were loaded for a reported total of ${serverTotal}.`);
  }

  return {
    competitors: rows,
    loadedCount: rows.length,
    loadedRowCount: rawRows.length,
    serverTotal,
    totalPages: pages.totalPages,
    successfulPages,
    failedPages,
    duplicateCount,
    maxObservedConcurrency,
    invalidTotalPages: pages.invalid,
    cappedTotalPages: pages.capped,
    complete,
    partial: !complete,
    notes,
  };
}
