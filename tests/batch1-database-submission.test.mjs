/**
 * Batch 1 Regression Suite: project database schema sync and Save Draft/Submit workflow.
 * Run with: node tests/batch1-database-submission.test.mjs
 *
 * These are static source/migration assertions. They complement the existing
 * Module 2/Task 3 suites and do not execute SQL or call live providers.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.resolve(relativePath), 'utf8');

console.log('\n================ BATCH 1 DATABASE & SUBMISSION VERIFICATION ================');

console.log('\n[1/7] Verifying forward-only currency-provenance schema repair...');
const syncMigrationPath = 'supabase/migrations/20261127040000_batch1_project_currency_provenance_sync.sql';
assert.ok(fs.existsSync(path.resolve(syncMigrationPath)), 'Forward-only corrective migration must exist');
const syncMigration = read(syncMigrationPath);
assert.ok(
  syncMigration.includes('add column if not exists exchange_rate numeric(10,4)') &&
    syncMigration.includes('add column if not exists exchange_rate_source text') &&
    syncMigration.includes('add column if not exists exchange_rate_timestamp timestamptz'),
  'Corrective migration must idempotently create all three currency-provenance columns'
);
assert.ok(
  syncMigration.includes('update public.projects') &&
    syncMigration.includes('State Bank of Pakistan Benchmark') &&
    syncMigration.includes('Canonical PKR'),
  'Corrective migration must backfill provenance for legacy rows'
);
assert.ok(
  syncMigration.includes("notify pgrst, 'reload schema'"),
  'Corrective migration must explicitly refresh the PostgREST schema cache'
);
const originalMigration = read('supabase/migrations/20261123020000_module1_module2_remediation.sql');
assert.ok(
  originalMigration.includes('add column if not exists exchange_rate'),
  'The original migration intent must remain unchanged (forward-only repair)'
);
const manualSql = read('supabase/manual/batch1_project_currency_provenance.sql');
assert.ok(
  manualSql.includes('Supabase Dashboard -> SQL Editor') &&
    manualSql.includes('add column if not exists exchange_rate') &&
    manualSql.includes("notify pgrst, 'reload schema'"),
  'A standalone SQL-editor script must be available for manual application'
);

console.log('\n[2/7] Verifying schema artifacts and TypeScript types are in sync...');
const combinedSchema = read('supabase/combined_schema.sql');
assert.ok(
  /exchange_rate\s+numeric\(10,4\)/.test(combinedSchema) &&
    /exchange_rate_source\s+text/.test(combinedSchema) &&
    /exchange_rate_timestamp\s+timestamptz/.test(combinedSchema),
  'combined_schema.sql must document the currency-provenance columns'
);
assert.ok(
  /budget_currency\s+text not null default 'PKR'/.test(combinedSchema),
  'combined_schema.sql must reflect the PKR-first default'
);
const projectTypes = read('src/types/project.ts');
assert.ok(
  projectTypes.includes('exchange_rate: number | null') &&
    projectTypes.includes('exchange_rate_source: string | null') &&
    projectTypes.includes('exchange_rate_timestamp: string | null'),
  'Project type must expose nullable provenance fields for legacy rows'
);

console.log('\n[3/7] Verifying API create/update persistence and provenance source...');
const createRoute = read('src/app/api/projects/route.ts');
assert.ok(createRoute.includes('exchange_rate: exchangeRate'), 'POST must persist exchange_rate');
assert.ok(
  createRoute.includes('BENCHMARK_EXCHANGE_RATE'),
  'POST must derive the benchmark rate from the shared currency service'
);
assert.ok(
  createRoute.includes('product_file_url: body.product_file_url'),
  'POST must persist attachment metadata for files uploaded before the draft exists'
);
const updateRoute = read('src/app/api/projects/[id]/route.ts');
assert.ok(updateRoute.includes('updates.exchange_rate'), 'PATCH must refresh exchange_rate');
assert.ok(
  updateRoute.includes('hasGeoUpdate') && updateRoute.includes('validateProjectFields(body)'),
  'PATCH must validate partial geographic updates in saved context'
);
assert.ok(updateRoute.includes('delete updates.owner_id'), 'PATCH must still reject client-supplied owner_id');

console.log('\n[4/7] Verifying stale-data submission guard in the wizard...');
const wizard = read('src/components/wizard/BusinessIdeaWizard.tsx');
assert.ok(
  wizard.includes('if (!saveRes.ok)') &&
    wizard.includes('Failed to save the latest draft before submission'),
  'handleSubmit must check the final PATCH response and stop on failure'
);
assert.ok(
  wizard.includes('product_file_url: formData.product_file_url ?? null'),
  'Final draft payload must explicitly clear removed attachments'
);
assert.ok(wizard.includes('setAutosaveError'), 'Autosave failures must be retained in visible UI state');
assert.ok(
  wizard.includes('role="status"') && wizard.includes('Retry'),
  'Autosave failure status must be announced and offer a retry'
);
assert.ok(
  !wizard.includes("if (!silent) showToast(err.error || 'Failed to save draft', 'error')"),
  'Autosave errors must not be silently suppressed'
);

console.log('\n[5/7] Verifying validation is consistent with submission and report schema...');
const validation = read('src/lib/validation/project.ts');
assert.ok(
  validation.includes('All submissions need coordinates'),
  'Step validation must require the coordinates that submission and reports require'
);
assert.ok(
  !validation.includes('regionHasCoverage && !hasCoordinates'),
  'Coordinate requirement must not be gated by data coverage'
);
const submitRoute = read('src/app/api/projects/[id]/submit/route.ts');
assert.ok(
  submitRoute.includes('PAKISTAN_BOUNDS.minLat') && submitRoute.includes('PAKISTAN_BOUNDS.maxLng'),
  'Submit route must use the shared Pakistan bounds'
);

console.log('\n[6/7] Verifying attachment metadata and upload security...');
const uploadRoute = read('src/app/api/projects/upload/route.ts');
assert.ok(
  uploadRoute.includes('const { error: metadataError } = await metadataQuery'),
  'Upload route must check project metadata persistence errors'
);
assert.ok(
  uploadRoute.includes("project.status !== 'draft'"),
  'Upload route must reject attachment changes to submitted projects'
);
assert.ok(
  uploadRoute.includes('if (!isAdmin) metadataQuery = metadataQuery.eq(\'owner_id\', user.id);'),
  'Admin and owner metadata paths must be consistent with the verified ownership check'
);
assert.ok(!uploadRoute.includes('getPublicUrl'), 'Attachments must stay private (storage path only)');

console.log('\n[7/7] Verifying secure submission RPC signature is preserved...');
const secureRpc = read('supabase/migrations/20261124000000_secure_submit_project_rpc.sql');
assert.ok(
  secureRpc.includes('p_project_id uuid') && !secureRpc.includes('p_user_id uuid'),
  'The caller-trusted two-argument RPC must not be reintroduced'
);
assert.ok(
  secureRpc.includes('auth.uid()') && secureRpc.includes('grant execute') && secureRpc.includes('to authenticated'),
  'Submission must remain authenticated and server-authorized'
);

console.log('\nPASS: Batch 1 database and submission workflow invariants are present.');
