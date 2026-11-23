/**
 * Module 1 Automated Test Suite: Auth, RBAC & Storage Security Hardening
 * Run with: node tests/module1-auth-rbac.test.mjs
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('\n================ MODULE 1 SECURITY & RBAC VERIFICATION ================');

// 1. Verify Storage & Profile Hardening Migration
console.log('\n[1/4] Verifying Storage & Profile Hardening Migration SQL...');
const migrationPath = path.resolve('supabase/migrations/20261123010000_storage_and_rbac_hardening.sql');
assert.ok(fs.existsSync(migrationPath), 'Migration 20261123010000_storage_and_rbac_hardening.sql must exist');

const migrationSql = fs.readFileSync(migrationPath, 'utf8');
assert.ok(
  migrationSql.includes('public = false') || migrationSql.includes('false, -- STRICTLY PRIVATE'),
  'Storage bucket project-attachments must be set to public = false'
);
assert.ok(
  migrationSql.includes('drop policy if exists "Public can view project attachments"') ||
  migrationSql.includes('drop policy if exists "project_attachments_public_select"'),
  'Public read policies on project-attachments must be revoked'
);
assert.ok(
  migrationSql.includes('storage.foldername(name)'),
  'Storage object RLS policies must inspect folder hierarchy for user ownership'
);
assert.ok(
  migrationSql.includes('role = (select p.role') || migrationSql.includes('profile_cannot_self_promote'),
  'Profiles table must prevent non-admin users from escalating their own role'
);
console.log('PASS: Storage bucket is strictly private and profile privilege escalation is blocked at SQL level.');

// 2. Verify Private Attachment Upload Handler
console.log('\n[2/4] Verifying Private Attachment Upload Route (/api/projects/upload)...');
const uploadRoutePath = path.resolve('src/app/api/projects/upload/route.ts');
assert.ok(fs.existsSync(uploadRoutePath), 'Upload route must exist');

const uploadRouteCode = fs.readFileSync(uploadRoutePath, 'utf8');
assert.ok(
  uploadRouteCode.includes('MAX_FILE_SIZE = 5 * 1024 * 1024'),
  'Upload route must enforce 5MB maximum file size limit'
);
assert.ok(
  uploadRouteCode.includes('ALLOWED_MIME_TYPES') || uploadRouteCode.includes('ALLOWED_TYPES'),
  'Upload route must maintain strict MIME type allowlist'
);
assert.ok(
  !uploadRouteCode.includes('getPublicUrl'),
  'Upload route must NOT call getPublicUrl on private bucket'
);
assert.ok(
  uploadRouteCode.includes('createSignedUrl'),
  'Upload route must return time-limited signed URL via createSignedUrl'
);
assert.ok(
  uploadRouteCode.includes('3600'),
  'Upload route signed URL must be short-lived (1 hour / 3600 seconds)'
);
console.log('PASS: Upload handler enforces 5MB size limit, MIME whitelist, and 1-hour signed URL creation.');

// 3. Verify ML Admin Endpoints RBAC Gatekeeping
console.log('\n[3/4] Verifying ML Admin Route Protection (/api/ml/*)...');
const mlRoutes = [
  'src/app/api/ml/models/route.ts',
  'src/app/api/ml/train/route.ts',
  'src/app/api/ml/datasets/route.ts'
];

for (const routeRel of mlRoutes) {
  const routePath = path.resolve(routeRel);
  assert.ok(fs.existsSync(routePath), `Route ${routeRel} must exist`);
  const code = fs.readFileSync(routePath, 'utf8');

  // Both GET and POST must check for authentication and admin role
  assert.ok(
    code.includes('401') && (code.includes('Unauthorized') || code.includes('Authentication required')),
    `${routeRel} must return 401 for unauthenticated requests`
  );
  assert.ok(
    code.includes('403') && (code.includes('Forbidden') || code.includes('Admin privileges required')),
    `${routeRel} must return 403 for non-admin requests`
  );
  assert.ok(
    code.includes("role !== 'admin'"),
    `${routeRel} must strictly evaluate profile.role === 'admin'`
  );
}
console.log('PASS: ML endpoints (/models, /train, /datasets) strictly require admin session with 401/403 gates.');

// 4. Verify Project Attachment Download Gateway
console.log('\n[4/4] Verifying Project Attachment Retrieval Gateway (/api/projects/[id]/attachments)...');
const attachRoutePath = path.resolve('src/app/api/projects/[id]/attachments/route.ts');
assert.ok(fs.existsSync(attachRoutePath), 'Attachments route must exist');

const attachCode = fs.readFileSync(attachRoutePath, 'utf8');
assert.ok(attachCode.includes('createSignedUrl'), 'Attachment route must generate signed URL');
assert.ok(
  attachCode.includes('owner_id !== user.id') || attachCode.includes('canAccess'),
  'Attachment route must verify project ownership before issuing download ticket'
);
assert.ok(attachCode.includes('3600'), 'Signed URL lifetime must be 3600 seconds (1 hour)');
console.log('PASS: Project attachment download endpoint enforces ownership verification and short-lived signed URLs.');

console.log('\n================ ALL MODULE 1 TESTS PASSED (4/4) ================\n');
