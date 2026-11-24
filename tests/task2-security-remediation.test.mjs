/**
 * Task 2 Automated Regression Suite: Submission, Storage & Password Security Remediation
 * Run with: node tests/task2-security-remediation.test.mjs
 *
 * These are static source/migration assertions. They verify that the security
 * fixes are present in the code and migrations; they do not replace runtime
 * database testing on a live Supabase instance.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('\n================ TASK 2 SECURITY REMEDIATION VERIFICATION ================');

// 1. Secure single-argument submission RPC
console.log('\n[1/6] Verifying secure submit_project_for_feasibility RPC...');
const rpcMigrationPath = path.resolve('supabase/migrations/20261124000000_secure_submit_project_rpc.sql');
assert.ok(fs.existsSync(rpcMigrationPath), 'Secure RPC migration must exist');
const rpcSql = fs.readFileSync(rpcMigrationPath, 'utf8');

assert.ok(
  rpcSql.includes('create or replace function public.submit_project_for_feasibility(') &&
  rpcSql.includes('p_project_id uuid'),
  'RPC must be redefined with a single p_project_id argument'
);
assert.ok(
  !rpcSql.includes('p_user_id'),
  'RPC must not accept a caller-supplied user id'
);
assert.ok(
  rpcSql.includes('v_user_id uuid := auth.uid();') && rpcSql.includes('if v_user_id is null then'),
  'RPC must derive identity from auth.uid() and reject NULL authentication'
);
assert.ok(
  rpcSql.includes('drop function if exists public.submit_project_for_feasibility(uuid, uuid);'),
  'Migration must drop the old insecure two-argument signature'
);
assert.ok(
  rpcSql.includes('revoke all on function public.submit_project_for_feasibility(uuid) from public;') &&
  rpcSql.includes('revoke all on function public.submit_project_for_feasibility(uuid) from anon;') &&
  rpcSql.includes('grant execute on function public.submit_project_for_feasibility(uuid) to authenticated;'),
  'Execution must be revoked from PUBLIC/anon and granted only to authenticated'
);
assert.ok(
  rpcSql.includes('for update;'),
  'RPC must preserve the row-level lock'
);
console.log('PASS: RPC derives identity from auth.uid(), rejects NULL, and is locked down to authenticated only.');

// 2. Submit route has no non-atomic fallback
console.log('\n[2/6] Verifying submit route contains no non-atomic fallback...');
const submitCode = fs.readFileSync(path.resolve('src/app/api/projects/[id]/submit/route.ts'), 'utf8');
assert.ok(
  submitCode.includes('submit_project_for_feasibility') && submitCode.includes('p_project_id: id'),
  'Submit route must call the RPC with the project ID only'
);
assert.ok(
  !submitCode.includes('p_user_id'),
  'Submit route must not pass a caller-supplied user id to the RPC'
);
assert.ok(
  !submitCode.includes('feasibility_reports'),
  'Submit route must not create a report directly (no fallback path)'
);
assert.ok(
  submitCode.includes('runDataCollection'),
  'Submit route must preserve the Module 3 handoff'
);
assert.ok(
  submitCode.includes('already_submitted: true') && submitCode.includes('already been submitted'),
  'Submit route must preserve idempotent response behavior'
);
console.log('PASS: Only the atomic RPC submits; no fallback report/status write remains.');

// 3. One-shot combined schema bucket is private
console.log('\n[3/6] Verifying combined_schema.sql private attachments bucket...');
const combinedSchema = fs.readFileSync(path.resolve('supabase/combined_schema.sql'), 'utf8');
assert.ok(
  combinedSchema.includes('false, -- STRICTLY PRIVATE'),
  'combined_schema must configure project-attachments as private'
);
assert.ok(
  !combinedSchema.includes('public = true'),
  'combined_schema must not configure any bucket as public'
);
assert.ok(
  !combinedSchema.includes('create policy "Public can view project attachments"'),
  'combined_schema must not create a public-read attachment policy'
);
console.log('PASS: One-shot schema creates a private, owner-isolated attachments bucket.');

// 4. Forward-only hardening migration
console.log('\n[4/6] Verifying forward-only storage & password hardenings...');
const hardeningMigrationPath = path.resolve('supabase/migrations/20261124010000_private_attachments_and_password_completion.sql');
assert.ok(fs.existsSync(hardeningMigrationPath), 'Forward hardening migration must exist');
const hardeningSql = fs.readFileSync(hardeningMigrationPath, 'utf8');

assert.ok(
  hardeningSql.includes('false, -- STRICTLY PRIVATE') &&
  hardeningSql.includes('drop policy if exists "Public can view project attachments" on storage.objects;'),
  'Forward migration must force the bucket private and drop legacy public policies'
);
assert.ok(
  !hardeningSql.includes('create policy "Public can view project attachments"'),
  'Forward migration must not recreate a public-read attachment policy'
);
assert.ok(
  hardeningSql.includes("v_jwt_role = 'service_role'"),
  'Profile integrity trigger must permit the trusted server-only service role'
);
console.log('PASS: Forward migration corrects deployed bucket privacy and enables server-only flag completion.');

// 5. Server-side password completion route
console.log('\n[5/6] Verifying server-side password completion route...');
const passwordRoutePath = path.resolve('src/app/api/auth/complete-password-change/route.ts');
assert.ok(fs.existsSync(passwordRoutePath), 'Password completion route must exist');
const passwordRouteCode = fs.readFileSync(passwordRoutePath, 'utf8');

assert.ok(
  passwordRouteCode.includes('supabase.auth.getUser()'),
  'Route must verify the authenticated session server-side'
);
assert.ok(
  passwordRouteCode.includes('supabase.auth.updateUser({ password })'),
  'Route must update the password through the authenticated session'
);
assert.ok(
  passwordRouteCode.includes('createAdminClient()') && passwordRouteCode.includes(".eq('id', user.id)") &&
  passwordRouteCode.includes('must_change_password: false'),
  'Route must clear the flag via the server-only admin client targeting the session user id only'
);
assert.ok(
  passwordRouteCode.includes('password_updated: true') && passwordRouteCode.includes('retry_required: true'),
  'Route must report a partial failure with a safe retry signal instead of false success'
);
assert.ok(
  !passwordRouteCode.includes('body.user_id') && !passwordRouteCode.includes('target_user_id'),
  'Route must never accept a target user id from the browser'
);
console.log('PASS: Password completion is server-side and reports success only when both steps succeed.');

// 6. Update-password page uses the secure server flow
console.log('\n[6/6] Verifying update-password page delegates to the server route...');
const updatePasswordPage = fs.readFileSync(path.resolve('src/app/update-password/page.tsx'), 'utf8');
assert.ok(
  updatePasswordPage.includes('/api/auth/complete-password-change'),
  'Page must delegate completion to the server route'
);
assert.ok(
  !updatePasswordPage.includes('must_change_password: false'),
  'Page must not attempt the privileged flag write from the browser'
);
assert.ok(
  !updatePasswordPage.includes('auth.updateUser'),
  'Page must not perform the password update directly from the browser'
);
console.log('PASS: Password page no longer reports false success from a client-side flag write.');

console.log('\n================ ALL TASK 2 SECURITY TESTS PASSED (6/6) ================\n');
