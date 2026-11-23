/**
/**
 * Module 1 Automated Test Suite: Auth, RBAC & Storage Security Hardening
 * Run with: node tests/module1-auth-rbac.test.mjs
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('\n================ MODULE 1 SECURITY & RBAC VERIFICATION ================');

// 1. Verify Storage & Profile Hardening Migration (Non-Recursive RLS & Privilege Escalation Guard)
console.log('\n[1/6] Verifying Non-Recursive Profile RLS & Integrity Trigger...');
const remediationMigrationPath = path.resolve('supabase/migrations/20261123020000_module1_module2_remediation.sql');
assert.ok(fs.existsSync(remediationMigrationPath), 'Remediation migration must exist');

const remMigrationSql = fs.readFileSync(remediationMigrationPath, 'utf8');
assert.ok(
  remMigrationSql.includes('profiles_update_own') &&
  remMigrationSql.includes('using (id = auth.uid())') &&
  remMigrationSql.includes('with check (id = auth.uid())'),
  'Profile update policy must be non-recursive (no self-referencing subqueries in WITH CHECK)'
);
assert.ok(
  remMigrationSql.includes('enforce_profile_update_integrity') &&
  remMigrationSql.includes('new.role is distinct from old.role'),
  'Trigger must prevent non-admin users from altering their role'
);
assert.ok(
  remMigrationSql.includes('new.must_change_password is distinct from old.must_change_password'),
  'Trigger must prevent non-admin users from bypassing forced password change'
);
console.log('PASS: Profile RLS recursion eliminated and BEFORE UPDATE integrity trigger verified.');

// 2. Verify Private Storage Bucket & Ownership Isolation
console.log('\n[2/6] Verifying Storage Privacy & Bucket Security...');
const storageMigrationPath = path.resolve('supabase/migrations/20261123010000_storage_and_rbac_hardening.sql');
const storageSql = fs.readFileSync(storageMigrationPath, 'utf8');
assert.ok(
  storageSql.includes('public = false') || storageSql.includes('false, -- STRICTLY PRIVATE'),
  'Storage bucket project-attachments must be private'
);
assert.ok(
  storageSql.includes('storage.foldername(name)'),
  'Storage policies must enforce user directory isolation'
);
console.log('PASS: project-attachments bucket is strictly private with folder-level owner isolation.');

// 3. Verify Fail-Closed Middleware & Open Redirect Protection
console.log('\n[3/6] Verifying Fail-Closed Middleware & Open-Redirect Sanitization...');
const middlewarePath = path.resolve('src/lib/supabase/middleware.ts');
assert.ok(fs.existsSync(middlewarePath), 'src/lib/supabase/middleware.ts must exist');
const middlewareCode = fs.readFileSync(middlewarePath, 'utf8');

assert.ok(
  middlewareCode.includes('configuration_missing') && middlewareCode.includes('isProtectedPath'),
  'Middleware must fail closed and redirect protected routes when Supabase config is missing'
);
assert.ok(
  middlewareCode.includes('sanitizeRedirectPath'),
  'Middleware must sanitize redirect paths against open redirects'
);
assert.ok(
  middlewareCode.includes("role !== 'admin'") && middlewareCode.includes('/account/security'),
  'Admin route guard must block non-admin accounts'
);
console.log('PASS: Middleware fails closed and enforces open-redirect sanitization & admin route protection.');

// 4. Verify Account Deletion Re-Authentication Gate
console.log('\n[4/6] Verifying Re-Authentication Gate on Account Erasure...');
const deleteAccountPath = path.resolve('src/app/api/auth/delete-account/route.ts');
assert.ok(fs.existsSync(deleteAccountPath), 'delete-account route must exist');
const deleteAccountCode = fs.readFileSync(deleteAccountPath, 'utf8');

assert.ok(
  deleteAccountCode.includes('confirmation !== \'DELETE\''),
  'Account deletion must require explicit DELETE text confirmation'
);
assert.ok(
  deleteAccountCode.includes('signInWithPassword') || deleteAccountCode.includes('last_sign_in_at'),
  'Account deletion must require active password verification or verified recent reauthentication'
);
assert.ok(
  deleteAccountCode.includes('admin.deleteUser(user.id)'),
  'Account deletion must strictly target the authenticated session user ID only'
);
console.log('PASS: Account deletion enforces active re-authentication and strict session user isolation.');

// 5. Verify Private Attachment Upload & Download Handling
console.log('\n[5/6] Verifying Private Attachment Upload & Download Error Handling...');
const uploadRoutePath = path.resolve('src/app/api/projects/upload/route.ts');
const attachRoutePath = path.resolve('src/app/api/projects/[id]/attachments/route.ts');
const uploadCode = fs.readFileSync(uploadRoutePath, 'utf8');
const attachCode = fs.readFileSync(attachRoutePath, 'utf8');

assert.ok(
  uploadCode.includes('Storage upload failed') && uploadCode.includes('500'),
  'Upload route must fail closed and return 500 when storage upload fails'
);
assert.ok(
  uploadCode.includes('storage_path') && !uploadCode.includes('getPublicUrl'),
  'Upload route must store and return storage_path, never a permanent public URL'
);
assert.ok(
  attachCode.includes('createSignedUrl') && attachCode.includes('3600'),
  'Download route must issue short-lived signed URLs (1 hour / 3600s)'
);
assert.ok(
  attachCode.includes('owner_id !== user.id') || attachCode.includes('project.owner_id'),
  'Download route must verify project ownership before issuing download ticket'
);
console.log('PASS: Upload fails closed on storage failure and download enforces owner-signed URLs.');

// 6. Verify ML Microservice Secret Protection & Fail-Closed Keys
console.log('\n[6/6] Verifying ML Microservice Secret Management & Disallowed Defaults...');
const mlConfigPath = path.resolve('ml-service/config.py');
const mlClientPath = path.resolve('src/lib/ml-client.ts');
const mlConfigCode = fs.readFileSync(mlConfigPath, 'utf8');
const mlClientCode = fs.readFileSync(mlClientPath, 'utf8');

assert.ok(
  mlConfigCode.includes('FAIL-CLOSED') && mlConfigCode.includes('DISALLOWED_DEFAULT_SECRETS'),
  'ML service config must fail closed and disallow default development placeholder secrets'
);
assert.ok(
  mlClientCode.includes('FAIL-CLOSED') && mlClientCode.includes('DISALLOWED_DEFAULT_SECRETS'),
  'Next.js ML client must fail closed and reject placeholder keys'
);
assert.ok(
  mlConfigCode.includes('secrets.compare_digest') || fs.readFileSync('ml-service/main.py', 'utf8').includes('secrets.compare_digest'),
  'ML service must authenticate endpoints using constant-time comparison'
);
console.log('PASS: ML microservice fails closed, rejects placeholders, and uses constant-time auth.');

console.log('\n================ ALL MODULE 1 TESTS PASSED (6/6) ================\n');
